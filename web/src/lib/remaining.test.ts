import assert from "node:assert/strict";
import { test } from "node:test";
import type { Link } from "tally-client";

import { remaining } from "./remaining";

function link(max_payments: number, payments: number): Link {
  return {
    id: 1n,
    merchant: "GMERCHANT",
    token: "CTOKEN",
    amount: 100n,
    max_payments,
    payments,
    collected: 0n,
    status: { tag: "Open", values: undefined },
    created_at: 0n,
    expires_at: 0n,
  };
}

test("an uncapped link has no remaining count", () => {
  assert.equal(remaining(link(0, 12)), undefined);
});

test("a capped link reports what is left", () => {
  assert.equal(remaining(link(50, 2)), 48);
  assert.equal(remaining(link(1, 0)), 1);
});

test("a sold-out link reports zero rather than a negative", () => {
  assert.equal(remaining(link(3, 3)), 0);
  // Cannot happen through the contract, but a UI must not print "-2 left".
  assert.equal(remaining(link(3, 5)), 0);
});
