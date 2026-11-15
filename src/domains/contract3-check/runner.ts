// Executes one admitted program exactly once (INTERFACE.md section 4):
// argument vector only (no shell, no PATH lookup), null stdin, only the
// admitted environment, bounded capture, wall-time budget with SIGTERM then
// SIGKILL (LIFE-11). The runner has no retry path of any kind.

import { BUDGETS } from "./budgets.ts";
import type {
  ProgramObservation,
  ProgramSpec,
  StreamCapture,
} from "./types.ts";

type Spawned = ReturnType<typeof Bun.spawn<"ignore", "pipe", "pipe">>;

function concat(chunks: Uint8Array[], size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

async function readBounded(
  stream: ReadableStream<Uint8Array>,
  max: number,
  onOver: () => void,
): Promise<StreamCapture> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  let overBudget = false;
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (overBudget) continue;
    if (size + value.length > max) {
      chunks.push(value.subarray(0, max - size));
      size = max;
      overBudget = true;
      onOver();
      continue;
    }
    chunks.push(value);
    size += value.length;
  }
  return { bytes: concat(chunks, size), overBudget };
}

function terminate(child: Spawned): void {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  const escalation = setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGKILL");
  }, BUDGETS.TARGET_KILL_GRACE_MS);
  void child.exited.then(() => clearTimeout(escalation));
}

/** While a target runs, the checker's own stop signal stops it first (LIFE-11). */
function forwardStopSignals(child: Spawned): () => void {
  const stop = (exitCode: number) => {
    child.kill("SIGTERM");
    const force = setTimeout(() => {
      child.kill("SIGKILL");
      process.exit(exitCode);
    }, 400);
    void child.exited.then(() => {
      clearTimeout(force);
      process.exit(exitCode);
    });
  };
  const onInterrupt = () => stop(130);
  const onTerminate = () => stop(143);
  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onTerminate);
  // bun-types overrides hide the Node signal overload of removeListener.
  const events = process as unknown as {
    removeListener(event: string, listener: () => void): unknown;
  };
  return () => {
    events.removeListener("SIGINT", onInterrupt);
    events.removeListener("SIGTERM", onTerminate);
  };
}

function notStarted(error: unknown): ProgramObservation {
  const empty = { bytes: new Uint8Array(), overBudget: false };
  return {
    started: false,
    startError: error instanceof Error ? error.message : "spawn failed",
    stdout: empty,
    stderr: empty,
    exit: null,
    timedOut: false,
  };
}

function resolveProgram(program: string): string {
  return program === "bun-runtime" ? process.execPath : program;
}

export async function runProgram(
  spec: ProgramSpec,
): Promise<ProgramObservation> {
  let child: Spawned;
  try {
    child = Bun.spawn({
      cmd: [resolveProgram(spec.program), ...spec.args],
      cwd: spec.cwd,
      env: { ...spec.env },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch (error) {
    return notStarted(error);
  }
  const release = forwardStopSignals(child);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    terminate(child);
  }, BUDGETS.TARGET_RUN_MAX_MS);
  const [stdout, stderr] = await Promise.all([
    readBounded(child.stdout, BUDGETS.TARGET_STDOUT_MAX_BYTES, () =>
      terminate(child),
    ),
    readBounded(child.stderr, BUDGETS.TARGET_STDERR_MAX_BYTES, () =>
      terminate(child),
    ),
  ]);
  await child.exited;
  clearTimeout(timer);
  release();
  return {
    started: true,
    stdout,
    stderr,
    exit:
      child.signalCode !== null
        ? { signal: child.signalCode }
        : { code: child.exitCode ?? 1 },
    timedOut,
  };
}

/** Read one captured stream file once, under the same byte budget. */
export async function readCaptured(
  path: string,
  max: number,
): Promise<StreamCapture> {
  const bytes = new Uint8Array(
    await Bun.file(path)
      .slice(0, max + 1)
      .arrayBuffer(),
  );
  return bytes.length > max
    ? { bytes: bytes.subarray(0, max), overBudget: true }
    : { bytes, overBudget: false };
}
