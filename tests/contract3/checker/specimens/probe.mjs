// fallow-ignore-file unused-file -- disposable read-only probe started by the checker through an admitted probe (D2); nothing imports it
// fallow-ignore-file boundary-violation -- disposable specimen outside every boundary zone by design
//
// Read-only state probe for D2. Hand-written by the independent binder.
// Prints the bytes of the file named by SPECIMEN_STATE, or nothing when the
// file does not exist. Never writes. Exits 0 on success and 70 otherwise.
import { readFileSync } from "node:fs";

const statePath = process.env.SPECIMEN_STATE;
if (statePath === undefined) {
  process.stderr.write("probe: SPECIMEN_STATE is not set\n");
  process.exit(70);
}
let bytes = Buffer.alloc(0);
try {
  bytes = readFileSync(statePath);
} catch (error) {
  if (error.code !== "ENOENT") {
    process.stderr.write("probe: state file unreadable\n");
    process.exit(70);
  }
}
process.stdout.write(bytes, () => process.exit(0));
