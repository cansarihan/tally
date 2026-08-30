# Architecture

Tally is two things: a contract that records payments, and a page that collects
them. Neither ever holds money.

```
  customer ──opens──▶ /pay/:id ──signs──▶ pay(id, payer, amount)
                                              │
                          ┌───────────────────┴───────────────────┐
                          │  1. check the link is still payable   │
                          │  2. write the payment record          │
                          │  3. token.transfer(payer → merchant)  │
                          └───────────────────────────────────────┘
                                              │
  merchant ──opens──▶ dashboard ◀──reads──────┘
```

## The decision everything else follows from

**The contract is not a custodian.** `pay` moves tokens straight from the payer
to the merchant and writes a record in the same transaction. There is no
balance held at the contract address, no withdrawal function, and no admin.

That removes the two failure modes payment contracts usually die of: a pooled
balance worth attacking, and a withdrawal path that can be tricked. The worst a
bug in Tally can do is misrecord a payment that already arrived at the right
place. A test asserts the contract's own token balance is still zero after
every operation.

The cost is that Tally cannot do escrow, refunds, or holds. Those need custody,
and custody is exactly what was traded away.

## One primitive, several products

Two fields are allowed to be zero, and that is the whole product surface:

| `amount` | `max_payments` | What it is |
| --- | --- | --- |
| fixed | `1` | An invoice — closes itself once paid |
| fixed | `n` | A limited sale: `n` seats, tickets, units |
| fixed | `0` | A product with no cap |
| `0` | `0` | A tip jar or donation page — the payer chooses |

The composer in the UI asks which of these the merchant wants and fills in the
pair. The contract only ever sees the numbers.

## State

| Key | Holds |
| --- | --- |
| `NextId` | the next link id |
| `Link(id)` | one link and its running totals |
| `Payment(id, seq)` | one settled payment |
| `Totals(merchant)` | link and payment counts |
| `MerchantLink(merchant, seq)` | that merchant's links, for paging |
| `Volume(merchant, token)` | lifetime collected, per token |

The merchant index exists so a dashboard can page one seller's links without
scanning every link ever created. The counters exist so a headline number
never requires reading history.

## Derived state, not stored state

A link that sold out or ran past its expiry is still `Open` on chain, because
nothing had to write to it for either to become true. Both are computed:

```ts
if (link.status.tag === "Closed") return "closed";
if (link.max_payments > 0 && link.payments >= link.max_payments) return "complete";
if (now > Number(link.expires_at)) return "expired";
return "live";
```

The contract applies the same three rules inside `pay`. Keeping them derived
means no one has to send a transaction just to mark a link as finished.

## Ordering inside `pay`

The record is written **before** the transfer. Tokens are arbitrary contracts;
one that calls back into Tally finds the payment already counted, so a single
call cannot be counted twice. This costs nothing, because the contract holds no
funds for a re-entrant call to drain.

## The web app

Two routes and no router library:

- `/` — the merchant dashboard. Reads a merchant's record and, with a wallet
  connected, creates and closes links.
- `/pay/:id` — what a customer sees. One card: who is asking, how much, and a
  button. No navigation, no jargon.

A merchant record is public on chain, so `/?merchant=G…` renders it read-only.
Reading is open; only the buttons that sign need a wallet.

The payment path is a real URL rather than a hash, because that URL is the
product — it gets pasted into invoices and messages.

The TypeScript client is generated from the deployed contract's spec
(`scripts/bindings.sh`), so the app's types are the ones the chain enforces and
the contract's named errors reach the UI instead of raw status codes.
