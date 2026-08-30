import assert from "node:assert/strict";
import { test } from "node:test";
import type { Link } from "tally-client";

import { fillRatio, isPayable, linkKind, linkState } from "./status";

const NOW = 1_700_000_000;

function link(overrides: Partial<Link> = {}): Link {
  return {
    id: 1n,
    merchant: "GMERCHANT",
    token: "CTOKEN",
    amount: 100n,
    max_payments: 0,
    payments: 0,
    collected: 0n,
    status: { tag: "Open", values: undefined },
    created_at: BigInt(NOW - 100),
    expires_at: BigInt(NOW + 86_400),
    ...overrides,
  };
}

test("an open link inside its window is live", () => {
  assert.equal(linkState(link(), NOW), "live");
  assert.equal(isPayable(link(), NOW), true);
});

test("a link the merchant closed reads as closed", () => {
  const shut = link({ status: { tag: "Closed", values: undefined } });
  assert.equal(linkState(shut, NOW), "closed");
  assert.equal(isPayable(shut, NOW), false);
});

/**
 * Nothing writes to a link when it fills up or runs out of time, so both
 * states have to be derived rather than read from the stored status.
 */
test("a link that sold out is complete even though the chain still says open", () => {
  const soldOut = link({ max_payments: 3, payments: 3 });
  assert.equal(soldOut.status.tag, "Open");
  assert.equal(linkState(soldOut, NOW), "complete");
  assert.equal(isPayable(soldOut, NOW), false);
});

test("a link past its expiry is expired even though the chain still says open", () => {
  const stale = link({ expires_at: BigInt(NOW - 1) });
  assert.equal(stale.status.tag, "Open");
  assert.equal(linkState(stale, NOW), "expired");
});

test("closing beats selling out and expiring", () => {
  const shut = link({
    status: { tag: "Closed", values: undefined },
    max_payments: 1,
    payments: 1,
    expires_at: BigInt(NOW - 1),
  });
  assert.equal(linkState(shut, NOW), "closed");
});

test("an uncapped link never fills up", () => {
  const jar = link({ max_payments: 0, payments: 999 });
  assert.equal(linkState(jar, NOW), "live");
  assert.equal(fillRatio(jar), undefined);
});

test("capacity is reported as a ratio", () => {
  assert.equal(fillRatio(link({ max_payments: 4, payments: 1 })), 0.25);
  assert.equal(fillRatio(link({ max_payments: 4, payments: 4 })), 1);
});

test("the two zero-able fields name four different products", () => {
  assert.equal(linkKind(link({ amount: 100n, max_payments: 1 })), "Invoice");
  assert.equal(linkKind(link({ amount: 100n, max_payments: 50 })), "Limited sale");
  assert.equal(linkKind(link({ amount: 100n, max_payments: 0 })), "Product");
  assert.equal(linkKind(link({ amount: 0n, max_payments: 0 })), "Open collection");
  assert.equal(linkKind(link({ amount: 0n, max_payments: 1 })), "Open invoice");
});
