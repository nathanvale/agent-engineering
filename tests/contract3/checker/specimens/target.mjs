// fallow-ignore-file unused-file -- disposable specimen started by the checker through an admitted run case; nothing imports it
// fallow-ignore-file boundary-violation -- disposable specimen outside every boundary zone by design
//
// Table-driven Contract 3 target specimen. Hand-written by the independent
// binder; it never imports checker or kernel code.
//
// Environment (admitted by the case, paths relative to the working directory):
//   SPECIMEN_TABLE    required: JSON table { argv, responses, counter?, state? }
//   SPECIMEN_COUNTER  optional: file holding a decimal run count
//
// The process argv after the script path must equal table.argv exactly.
// The run count before this run selects responses[min(count, last)].
// When SPECIMEN_COUNTER is set the count is written as count + 1 before any
// stdout byte. A response may append lines to table.state before printing.
// Any mismatch prints nothing on stdout, one line on stderr and exits 70.
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

const fail = (reason) => {
  process.stderr.write(`specimen: ${reason}\n`);
  process.exit(70);
};

const tablePath = process.env.SPECIMEN_TABLE;
if (tablePath === undefined) fail("SPECIMEN_TABLE is not set");
const table = JSON.parse(readFileSync(tablePath, "utf8"));
const argv = process.argv.slice(2);
if (JSON.stringify(argv) !== JSON.stringify(table.argv)) {
  fail("argv does not match the admitted table");
}

let count = 0;
const counterPath = process.env.SPECIMEN_COUNTER;
if (counterPath !== undefined) {
  try {
    count = Number.parseInt(readFileSync(counterPath, "utf8"), 10);
  } catch {
    count = 0;
  }
  writeFileSync(counterPath, `${count + 1}\n`);
}

const responses = table.responses;
const response = responses[Math.min(count, responses.length - 1)];
if (response.state !== undefined) {
  appendFileSync(table.state, response.state);
}

const emit = (source) => {
  if (source === null) return Buffer.alloc(0);
  if (typeof source === "string") return readFileSync(source);
  return Buffer.alloc(source.repeat, source.byte);
};

const stdout = emit(response.stdout);
const stderr = emit(response.stderr);
if (response.hang === true) {
  process.stdout.write(stdout);
  setInterval(() => undefined, 1000);
} else {
  process.stdout.write(stdout, () => {
    process.stderr.write(stderr, () => process.exit(response.exit));
  });
}
