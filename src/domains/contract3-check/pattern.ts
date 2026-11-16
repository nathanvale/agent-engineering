// Untrusted target patterns (INPUT-2): syntax is checked by compiling only;
// matching runs in a terminable Worker under finite size and time budgets.

import { BUDGETS, TIMINGS } from "./budgets.ts";

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

function runWorker(source: string, subject: string): Promise<MatchResult> {
  return new Promise((resolve) => {
    const worker = new Worker(WORKER_URL);
    let timer = setTimeout(() => finish("budget"), TIMINGS.WORKER_START_MAX_MS);
    let startedAt = 0;
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
        startedAt = performance.now();
        clearTimeout(timer);
        timer = setTimeout(() => finish("budget"), BUDGETS.PATTERN_MAX_MS);
        return;
      }
      if (answer === "invalid") finish("invalid");
      else if (answer) finish("match");
      // Fail closed (S2): a slow non-match may be the engine's own cutoff.
      else if (performance.now() - startedAt >= TIMINGS.PATTERN_FAIL_CLOSED_MS)
        finish("budget");
      else finish("no-match");
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
