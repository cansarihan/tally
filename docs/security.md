# Security review

A self-review by the people who built Tally. It is the input to a third-party
sign-off, not a substitute for one. Anything unverified says so.

- **Contract:** `contracts/links`, `soroban-sdk 27.0.6`
- **Reviewed wasm hash:** `293b2acc6e8b7133537c3f46defb31e4c57c89cd7a3f33e16e4021a7626efd33`
- **Automated coverage:** 22 contract tests, 18 web tests
- **External audit:** not commissioned

## Threat model

The usual target for a payments contract is its float. Tally has none, which
removes most of the attack surface before any code is written.

| Adversary | Wants | What stops them |
| --- | --- | --- |
| Anyone | Drain a pooled balance | There is no pooled balance |
| Anyone | Close or edit someone's link | `close` checks the caller is the merchant |
| A customer | Pay less than the asking price | Exact-amount links reject a mismatch |
| A customer | Buy past the capacity | Capacity checked on every payment |
| A customer | Pay a dead link | Expiry and closure both checked |
| A malicious token | Re-enter and double-count | Record written before the transfer |
| A merchant | See another merchant's takings | Records are keyed by merchant address |

Not defended against, by design: a merchant can close a link at any moment,
including between a customer opening the page and paying. The customer's
transaction then fails and costs them a fee. Nothing is lost but the fee.

## Invariants

| # | Invariant | Enforced | Tested |
| --- | --- | --- | --- |
| 1 | The contract's token balance is always zero | No path receives funds | ✅ |
| 2 | Exact-price links accept only that price | `pay` | ✅ |
| 3 | A capped link never exceeds its capacity | `pay` | ✅ |
| 4 | An expired or closed link takes nothing | `pay` | ✅ |
| 5 | Only the merchant closes their link | `close` | ✅ |
| 6 | Payment records match transfers one to one | Written in the same call | ✅ |
| 7 | Totals and volume are per merchant | Keyed by address | ✅ |
| 8 | A payment is strictly positive | `pay` | ✅ |
| 9 | Lifetime is bounded | `create` | ✅ |
| 10 | Page requests are bounded | `MAX_PAGE` | ✅ |

## Findings

### 1 — No custody · by design, and load-bearing

`pay` calls `token.transfer(payer, merchant, amount)`. The contract address
never appears as a recipient and no function transfers out of it. This is
verified by a test that asserts the contract's balance is zero after create,
pay, close, and repeated payments from several payers.

### 2 — Re-entrancy through a hostile token · addressed

The link and the payment record are written before the transfer, so a token
that calls back finds the payment already counted. Because there is no float,
a re-entrant call has nothing to drain even if it got through.

### 3 — Arithmetic overflow · addressed

`overflow-checks = true` on the release profile, so `i128` accumulation in
`collected` and `volume` traps rather than wrapping. This is off by default in
release builds and easy to lose in a profile edit — treat it as load-bearing.

### 4 — Unbounded reads · addressed

`links_of` and `payments_of` refuse a page larger than `MAX_PAGE` (100) rather
than letting a caller request an unbounded scan.

### 5 — A merchant can close a link mid-checkout · accepted

A customer whose page was open when the merchant closed the link will have
their transaction rejected, costing them a network fee. Simulation catches this
before signing in the normal case. The alternative — a grace period — would
mean a merchant cannot actually stop taking money, which is worse.

### 6 — Link ids are sequential and public · accepted

Anyone can read any link and enumerate all of them. Links are meant to be
shared, and their contents are a price and an address, not a secret. A link id
is not an access control mechanism and is not used as one.

### 7 — No refunds · by design

Money reaches the merchant in the same transaction, so Tally cannot reverse a
payment. A refund is the merchant sending funds back. Building refunds would
require holding payments, which is the custody this design exists to avoid.

## What has not been verified

- No third-party audit.
- No fuzzing or formal verification; coverage is example-based tests.
- Mainnet behaviour is untested. Everything above was exercised on testnet.
- Key custody is out of the contract's hands. A merchant who loses their wallet
  loses access to their links; the contract cannot help.

## Reproducing this review

```bash
cargo test                                  # 22 contract tests
npm test                                    # 18 web tests
cargo clippy --all-targets -- -D warnings
./scripts/build.sh                          # prints the wasm hash to compare
```

## Sign-off

| Reviewer | Role | Date | Outcome |
| --- | --- | --- | --- |
| _pending_ | Stellar mentor | | |
