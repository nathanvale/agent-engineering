// SUPPORTING TEST (T6 repair round 1, review S2). Measures the host
// platform's own regular-expression engine on the binder's hostile pattern and
// proves the checker's matcher fails closed on it. It prints one explicit
// result line so a hosted run (ubuntu-latest) shows its verdict, never a
// silent pass:
//   C3-PATTERN-ENGINE platform=... engine=<false|true|timeout> engineMs=...
//   matcher=<budget|no-match|...> matcherMs=... verdict=<PROVED|UNPROVED>
// What Linux must show: matcher=budget and verdict=PROVED. engine=false with a
// small engineMs is JavaScriptCore's own cutoff (a false non-match); the
// matcher must still answer budget, by the 250 ms Worker budget or by the
// fail-closed rule.

import { expect, test } from "bun:test";
import {
  BUDGETS,
  TIMINGS,
} from "../../../../src/domains/contract3-check/budgets.ts";
import { PatternMatcher } from "../../../../src/domains/contract3-check/pattern.ts";

const HOSTILE = "(a+)+b";
const SUBJECT = "a".repeat(40);
const ENGINE_WAIT_MS = 20_000;

/** The engine alone, in a terminable Worker, with a long wait: what does it answer, and when? */
function engineAlone(): Promise<{ answer: string; ms: number }> {
  return new Promise((resolve) => {
    const worker = new Worker(
      new URL(
        "../../../../src/domains/contract3-check/pattern-worker.ts",
        import.meta.url,
      ).href,
    );
    let started = performance.now();
    const timer = setTimeout(() => {
      void worker.terminate();
      resolve({ answer: "timeout", ms: performance.now() - started });
    }, ENGINE_WAIT_MS);
    worker.onmessage = (
      event: MessageEvent<boolean | "invalid" | "started">,
    ) => {
      if (event.data === "started") {
        started = performance.now();
        return;
      }
      clearTimeout(timer);
      void worker.terminate();
      resolve({ answer: String(event.data), ms: performance.now() - started });
    };
    worker.postMessage({ source: HOSTILE, subject: SUBJECT });
  });
}

test(
  "the hostile pattern is refused as budget exhaustion, never accepted as a non-match",
  async () => {
    const engine = await engineAlone();
    const started = performance.now();
    const matcher = await new PatternMatcher().match(HOSTILE, SUBJECT);
    const matcherMs = performance.now() - started;
    const verdict = matcher === "budget" ? "PROVED" : "UNPROVED";
    process.stdout.write(
      `C3-PATTERN-ENGINE platform=${process.platform}-${process.arch} bun=${Bun.version} engine=${engine.answer} engineMs=${Math.round(engine.ms)} budgetMs=${BUDGETS.PATTERN_MAX_MS} failClosedMs=${TIMINGS.PATTERN_FAIL_CLOSED_MS} matcher=${matcher} matcherMs=${Math.round(matcherMs)} verdict=${verdict}\n`,
    );
    expect(matcher).toBe("budget");
    expect(await new PatternMatcher().match("[a-z]+", "abc")).toBe("match");
    expect(await new PatternMatcher().match("[a-z]+", "abc1")).toBe("no-match");
  },
  ENGINE_WAIT_MS + 10_000,
);
