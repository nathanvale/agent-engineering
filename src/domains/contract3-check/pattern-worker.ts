// Terminable boundary for matching an untrusted target pattern (INPUT-2).
// Runs in its own Worker; the reader terminates it when the time budget ends.
// "started" lets the reader exclude Worker startup from the match budget.

interface MatchRequest {
  source: string;
  subject: string;
}

/** The Worker side of the message channel, earned from the runtime's own self. */
interface MatchPort {
  onmessage: ((event: MessageEvent<MatchRequest>) => void) | null;
  postMessage(message: boolean | "invalid" | "started"): void;
}

const port: MatchPort = self;

port.onmessage = (event: MessageEvent<MatchRequest>) => {
  const { source, subject } = event.data;
  port.postMessage("started");
  let matched: boolean | "invalid";
  try {
    matched = new RegExp(`^(?:${source})$`, "u").test(subject);
  } catch {
    matched = "invalid";
  }
  port.postMessage(matched);
};
