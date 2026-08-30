# Monthly growth report

Level 7 is measured on growth, so this file is the report. It is updated at the
end of each review period and kept in the repository so the numbers have a
history rather than a screenshot.

**Every figure here is pulled from the chain or from the feedback sheet.** No
number is estimated, and a metric that cannot yet be measured says so instead
of showing a zero that looks like a measurement.

---

## Period: August 2026 — build and testnet validation

### Where the product stands

The registry is deployed and working end to end on testnet. Mainnet is not
deployed, so every mainnet metric below is unmeasurable rather than zero.

| Metric | This period | Previous | Source |
| --- | --- | --- | --- |
| Mainnet users | *not deployed* | — | — |
| Mainnet payments | *not deployed* | — | — |
| Mainnet volume | *not deployed* | — | — |
| Testnet links created | 4 | — | `link_count()` |
| Testnet payments settled | 5 | — | `totals_of(merchant)` |
| Testnet volume | 302.5 XLM | — | `volume_of(merchant, XLM)` |
| Distinct payers | 2 | — | `payments_of` across links |
| Feedback responses | 0 | — | form not yet published |
| Social followers | *not started* | — | — |

Reproduce the on-chain rows:

```bash
CONTRACT=CCKFGICF5BOWRXXWC6KSGZQ3UIL6BT23ZO3RIMLNQA7M5XNB6PZT5WKR
stellar contract invoke --id $CONTRACT --source you --network testnet -- link_count
stellar contract invoke --id $CONTRACT --source you --network testnet -- \
  totals_of --merchant <MERCHANT_ADDRESS>
```

### What shipped

| Change | Commit |
| --- | --- |
| Payment link registry: create, pay, close | see `git log --grep "create, pay and close"` |
| Non-custodial payment path, with a test pinning it | see `git log --grep "cover the payment rules"` |
| Merchant dashboard and public checkout page | see `git log --grep "merchant dashboard and checkout"` |
| Read-only merchant view for phones and sharing | see `git log --grep "merchant dashboard and checkout"` |

### What was learned

Nothing from users yet — the feedback form is not published, so there is no
data to report. Saying anything else here would be inventing it.

Two things were learned from building and from screenshotting the real app:

- **A CSS element selector silently shrank the checkout amount.** `.receipt-head p`
  outranked `.receipt-amount`, so the figure a customer is asked to pay rendered
  at label size. Caught by looking at a screenshot, not by any test.
- **Suppressing build output hid a failing build.** A stale bundle was served
  for several minutes with no contract id in it. Build output is no longer
  piped to `/dev/null` in any workflow here.

### Next period

The gate is mainnet. Until the registry is deployed there, no user, payment, or
volume metric can move, and the growth requirements cannot be met.

1. Deploy to mainnet (~12 XLM) and verify the wasm hash on chain.
2. Publish the feedback form and link it from the app.
3. Take one real mainnet payment end to end before announcing.
4. Then: acquisition. Every payment link is an invite — the customer who pays
   one already has a wallet and has seen the product work.

---

## How to update this report

At the end of a period, append a new section above this one with the same table
and fill it from the commands above. Keep the previous period's numbers in the
"Previous" column so the direction is visible. Do not delete an old section.
