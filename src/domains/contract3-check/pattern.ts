// Untrusted target patterns (INPUT-2): syntax is checked by compiling only;
// matching runs in a terminable Worker under finite size and time budgets.

import { BUDGETS } from "./budgets.ts";

export type MatchResult = "match" | "no-match" | "invalid" | "budget";

export function patternSyntaxProblem(source: string): string | null {
  try {
    new RegExp(source, "u");
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "invalid pattern";
  }
}

function patternTooLarge(source: string): boolean {
  return (
    new TextEncoder().encode(source).length > BUDGETS.PATTERN_MAX_SOURCE_BYTES
  );
}

const WORKER_URL = new URL("./pattern-worker.ts", import.meta.url).href;

const WORKER_START_MAX_MS = 5_000;

function runWorker(source: string, subject: string): Promise<MatchResult> {
  return new Promise((resolve) => {
    const worker = new Worker(WORKER_URL);
    let timer = setTimeout(() => finish("budget"), WORKER_START_MAX_MS);
    function finish(result: MatchResult): void {
      clearTimeout(timer);
      void worker.terminate();
      resolve(result);
    }
    worker.onmessage = (
      event: MessageEvent<boolean | "invalid" | "started">,
    ) => {
      const answer = event.data;
      if (answer === "started") {
        clearTimeout(timer);
        timer = setTimeout(() => finish("budget"), BUDGETS.PATTERN_MAX_MS);
        return;
      }
      finish(answer === "invalid" ? "invalid" : answer ? "match" : "no-match");
    };
    worker.onerror = () => finish("invalid");
    worker.postMessage({ source, subject });
  });
}

export class PatternMatcher {
  private readonly cache = new Map<string, Promise<MatchResult>>();

  match(source: string, subject: string): Promise<MatchResult> {
    if (patternTooLarge(source)) return Promise.resolve("budget");
    if (
      new TextEncoder().encode(subject).length >
      BUDGETS.PATTERN_MAX_SUBJECT_BYTES
    )
      return Promise.resolve("budget");
    if (patternSyntaxProblem(source) !== null)
      return Promise.resolve("invalid");
    const key = JSON.stringify([source, subject]);
    let pending = this.cache.get(key);
    if (pending === undefined) {
      pending = runWorker(source, subject);
      this.cache.set(key, pending);
    }
    return pending;
  }
}
