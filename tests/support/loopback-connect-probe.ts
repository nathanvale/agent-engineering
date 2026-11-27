import { test } from "bun:test";
import { createConnection, type Socket } from "node:net";

const defaultProbeTimeoutMs = 500;

const loopbackSkipReason = "loopback connect refused by sandbox";

type TestCallback = () => void | Promise<void>;

type LoopbackTestRegistrar = {
  readonly run: (name: string, fn: TestCallback) => void;
  readonly skip: (name: string, fn: TestCallback) => void;
};

type ResolveLoopbackTestOptions = {
  readonly probe?: () => Promise<boolean>;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly register?: LoopbackTestRegistrar;
};

const defaultRegistrar: LoopbackTestRegistrar = {
  run: (name, fn) => {
    test(name, fn);
  },
  skip: (name, fn) => {
    test.skip(name, fn);
  },
};

function startLoopbackListener() {
  try {
    return Bun.listen({
      hostname: "127.0.0.1",
      port: 0,
      socket: {
        data() {
          return;
        },
      },
    });
  } catch {
    return undefined;
  }
}

function probeLoopbackConnect(
  timeoutMs = defaultProbeTimeoutMs,
): Promise<boolean> {
  const server = startLoopbackListener();
  if (!server) return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let socket: Socket | undefined;
    const finish = (allowed: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket?.destroy();
      server.stop(true);
      resolve(allowed);
    };
    const timer = setTimeout(() => {
      finish(false);
    }, timeoutMs);
    try {
      socket = createConnection({ host: "127.0.0.1", port: server.port });
      socket.once("connect", () => {
        finish(true);
      });
      socket.once("error", () => {
        finish(false);
      });
      socket.once("close", () => {
        finish(false);
      });
    } catch {
      finish(false);
    }
  });
}

export async function resolveLoopbackTest(
  options: ResolveLoopbackTestOptions = {},
): Promise<(name: string, fn: TestCallback) => void> {
  const probe = options.probe ?? probeLoopbackConnect;
  const env = options.env ?? process.env;
  const register = options.register ?? defaultRegistrar;
  const allowed = await probe();
  if (allowed) {
    return (name, fn) => {
      register.run(name, fn);
    };
  }
  if (env.CI === "true") {
    throw new Error(
      `loopback-connect-probe: ${loopbackSkipReason} under CI=true; refusing to skip loopback daemon tests in CI`,
    );
  }
  return (name, fn) => {
    register.skip(`${name} (${loopbackSkipReason})`, fn);
  };
}
