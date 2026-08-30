# A payment contract that holds nothing

*A build note from Tally, payment links on Soroban.*

Most on-chain payment products are built the same way. Money arrives at the
contract, sits there, and the merchant withdraws it later. It is the obvious
shape, it is what escrow needs, and it is where almost every exploit in the
category has happened — because a contract holding a pooled balance is a
target, and a withdrawal function is a lock with a keyhole.

Tally does payment links, and it holds nothing. The whole of `pay` is:

```rust
pub fn pay(env: Env, id: u64, payer: Address, amount: i128) -> Result<(), Error> {
    payer.require_auth();
    // … checks …

    link.payments += 1;
    link.collected += amount;
    storage::write_link(&env, &link);
    storage::write_payment(&env, sequence, &payment);

    token::TokenClient::new(&env, &link.token).transfer(&payer, &link.merchant, &amount);
    Ok(())
}
```

The contract address never appears as a recipient. No function transfers out of
it. The merchant's tokens arrive in the merchant's wallet in the same
transaction the customer signed, and the contract's job is to be the witness
that says *this payment was for link 42*.

## What that buys

**There is no float to steal.** The classic question you ask a payment contract
— what happens if someone drains the balance — has no answer here, because
there is no balance. A test pins it down rather than leaving it to the prose:

```rust
#[test]
fn payment_goes_straight_to_the_merchant() {
    let ctx = setup();
    let id = ctx.links.create(&ctx.merchant, &ctx.token, &250, &1, &WEEK);

    ctx.links.pay(&id, &ctx.payer, &250);

    assert_eq!(ctx.merchant_balance(), 250);
    assert_eq!(ctx.contract_balance(), 0, "the contract must never custody");
}
```

That last assertion runs after create, after pay, after close, and after
several payers settle the same link. If a future change ever routes money
through the contract, the suite says so.

**Re-entrancy stops being frightening.** The record is still written before the
`transfer`, so a hostile token that calls back finds the payment already
counted and cannot double it. But even if that ordering were wrong, there would
be nothing to drain. Defence in depth is cheaper when the thing being defended
is empty.

**There is no admin.** No pause, no fee switch, no upgrade authority. Nothing
to key-manage, and no address whose compromise matters. The contract cannot be
upgraded either; shipping new logic means deploying a new registry and pointing
the app at it, while old links keep working against the old one.

## What it costs

This is a real trade, not a free win.

**No refunds.** The money reached the merchant in the transaction the customer
signed. Tally cannot reverse it. A refund is the merchant sending funds back,
by hand, as a normal payment.

**No escrow, no holds, no disputes.** All three require the money to pause
somewhere, and pausing is custody. If your product needs a buyer to pay now and
a seller to be paid on delivery, you need a different contract — and you should
budget for the audit that a contract holding a float deserves.

**Failure is the customer's fee, not the merchant's risk.** If a merchant
closes a link between the customer opening the page and pressing pay, the
customer's transaction fails and costs them a network fee. Simulation catches
this before signing in the normal case. The alternative — a grace period during
which a closed link still accepts money — means a merchant cannot actually stop
taking payments, which is worse than a wasted fraction of a cent.

## The bit that surprised me: derived state

A link can stop being payable in three ways. It can be closed, it can sell out,
and it can expire. Only the first involves anyone sending a transaction.

The tempting design is a `Status` enum with `Open | Complete | Expired |
Closed`, kept accurate. But keeping it accurate means someone has to pay to
write `Complete` the moment the last unit sells, and pay again to write
`Expired` when the clock passes. Nobody is going to do that, so the stored
status drifts and the UI lies.

So the stored status has exactly two values, and the other two are computed
wherever they are needed — in the contract:

```rust
if link.status == Status::Closed { return Err(Error::Closed); }
if env.ledger().timestamp() > link.expires_at { return Err(Error::Expired); }
if link.max_payments > 0 && link.payments >= link.max_payments { return Err(Error::Full); }
```

and in the UI, in the same order:

```ts
export function linkState(link: Link, now: number): LinkState {
  if (link.status.tag === "Closed") return "closed";
  if (link.max_payments > 0 && link.payments >= link.max_payments) return "complete";
  if (now > Number(link.expires_at)) return "expired";
  return "live";
}
```

The rule that matters is that both must agree. If the dashboard called a link
live when the contract would reject it, a customer would sign a transaction
that could not succeed. The tests assert the derived states explicitly,
including the case that reads wrong at first glance:

```ts
test("a link that sold out is complete even though the chain still says open", () => {
  const soldOut = link({ max_payments: 3, payments: 3 });
  assert.equal(soldOut.status.tag, "Open");
  assert.equal(linkState(soldOut, NOW), "complete");
});
```

## Two zeroes, four products

One more thing worth stealing. Tally has a single primitive, and two of its
fields are allowed to be zero:

| `amount` | `max_payments` | What the merchant calls it |
| --- | --- | --- |
| fixed | `1` | An invoice |
| fixed | *n* | A limited sale — seats, tickets, units |
| fixed | `0` | A product |
| `0` | `0` | A tip jar |

The contract has no idea these are different products. It checks *if amount is
non-zero, the payment must match it* and *if the cap is non-zero, do not exceed
it*. The UI does the naming, because naming is a product concern and the chain
should not have opinions about vocabulary that will change.

## In short

- Ask whether your contract needs to hold the money, or only to *witness* that
  it moved. Witnessing is dramatically cheaper to secure.
- If it does not hold money, say so with a test that asserts its balance is
  zero, so the property survives the next contributor.
- State that changes because time passed, or because a counter hit a limit,
  should be derived rather than stored — nobody will pay gas to keep a status
  field honest.
- Fields allowed to be zero are how one primitive becomes several products
  without the contract knowing what a "tip jar" is.

---

Tally is Apache-2.0: <https://github.com/cansarihan/tally>. The contract is
around 300 lines of Rust. It is short enough to read before you trust it, which
is rather the point.
