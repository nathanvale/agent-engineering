// SUPPORTING TESTS (T6 Phase 2a). The provisional D1 adapter maps the
// major-agnostic checker outcome onto the host CLI's 2.0 result shape.
// Expected tuples are restated from INTERFACE.md section 6 (independent of
// the adapter's table). Not bound cases; no V row is proved here.

import { expect, test } from "bun:test";
import {
  checkerStations,
  executeCheck,
} from "../../../../src/domains/contract3-check/host-adapter.ts";

const IDENTITY = "example.contract3.check";

test("declared stations are the five interface tuples, all inspect and unchanged", () => {
  const stations = checkerStations(IDENTITY);
  expect(
    stations.map((station) => [
      station.outcome,
      station.causeCode,
      station.failureClass,
      station.exitCode,
    ]),
  ).toEqual([
    ["success", "SUCCESS_UNCHANGED", null, 0],
    ["refused", "USAGE_INVALID_INVOCATION", "usage", 2],
    ["refused", "DOMAIN_PRECONDITION_UNMET", "domain", 3],
    ["refused", "SCHEMA_INVALID_INPUT", "schema", 4],
    ["refused", "SCHEMA_UNSUPPORTED_CONTRACT", "schema", 4],
  ]);
  for (const station of stations) {
    expect(station.commandIdentity).toBe(IDENTITY);
    expect(station.effectClass).toBe("inspect");
    expect(station.transactionState).toBe("unchanged");
    expect(station.retryable).toBe(false);
  }
});

test("a usage refusal becomes a host refusal with null data and empty effects", async () => {
  const result = await executeCheck(IDENTITY, []);
  expect(result).toMatchObject({
    commandIdentity: IDENTITY,
    outcome: "refused",
    causeCode: "USAGE_INVALID_INVOCATION",
    failureClass: "usage",
    exitCode: 2,
    data: null,
    effectClass: "inspect",
    transactionState: "unchanged",
    effects: {
      completed: [],
      remaining: [],
      uncertain: [],
      inventoryComplete: true,
    },
  });
});
