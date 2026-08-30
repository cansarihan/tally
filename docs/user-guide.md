# User guide

Tally turns a price into a link. You send the link; whoever opens it pays you
in Stellar assets. The money arrives in your wallet directly — Tally never
holds it, so there is nothing to withdraw.

## What you need

- **Freighter**, the Stellar browser wallet — <https://freighter.app>
- **A little XLM** for network fees. They are fractions of a cent.

## Taking your first payment

1. Open the app and choose **Connect wallet**.
2. Choose **New payment link**.
3. Pick what the link is for:

   | Choice | Behaviour |
   | --- | --- |
   | **Invoice** | One payment at a fixed price, then it closes itself |
   | **Product** | Fixed price, limited quantity — stops when it sells out |
   | **Collection** | Any amount, any number of times: a tip jar or donation page |

4. Set the price, the quantity if it has one, and how many days it should last.
5. Create it, then use **Copy** to get the link and send it to whoever is paying.

Payments show up on your dashboard as they settle. Click a row to see who paid
and when.

## What your customer sees

One card: your address, the amount, and a button. They connect a wallet, press
the button, and get a receipt with a link to the payment on the network.

If the link has sold out, expired, or you closed it, they are told before they
sign anything rather than after.

## Reading the dashboard

| Column | Meaning |
| --- | --- |
| **Type** | Which of the three kinds this link is |
| **Price** | The fixed amount, or "Any amount" for a collection |
| **Status** | Live, Complete (sold out), Expired, or Closed |
| **Taken** | Payments so far, against capacity when there is one |
| **Collected** | Total received through this link |

**Complete** and **Expired** happen on their own — no one has to close the
link, and no transaction is needed. **Closed** means you pressed Close.

Your dashboard is also viewable read-only at `?merchant=<your address>`, which
is useful for checking takings on a phone without connecting a wallet.

## Things worth knowing

- **Closing a link does not reverse payments.** Money already paid reached you
  when it was paid. Closing only stops new ones.
- **There are no refunds in Tally.** Refunding is you sending money back. This
  is the trade for never holding your money in the first place.
- **A link id is not a secret.** Links are public and anyone can read one.
  Their contents are a price and an address, not private information.
- **Check the token.** A link can request any Stellar asset. The composer tells
  you which symbol and how many decimal places it found on chain — read it
  before publishing a price.

## When something is refused

| Error | Why | What to do |
| --- | --- | --- |
| `WrongAmount` | Exact-price link, different amount sent | Pay the amount shown |
| `Full` | The link sold out | Ask the seller for a new one |
| `Expired` | Past its end date | Ask for a new link |
| `Closed` | The seller closed it | Ask the seller |
| `NotMerchant` | Closing someone else's link | Only the creator can close it |
| `InvalidAmount` | Zero or negative | Enter a positive amount |
| `NotFound` | No such link | Check the address you were given |
