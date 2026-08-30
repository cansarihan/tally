# User feedback

Level 7 asks for a feedback sheet and for the product changes it caused. This
directory holds the form specification; the export lands here once responses
arrive.

## The form

Create it at <https://forms.google.com>, titled **Tally — tell us what happened**:

| # | Question | Type | Required |
| --- | --- | --- | --- |
| 1 | Your name | Short answer | Yes |
| 2 | Email | Short answer (email validation) | Yes |
| 3 | Stellar wallet address | Short answer, regex `^G[A-Z2-7]{55}$` | Yes |
| 4 | Did you create a link, pay one, or both? | Multiple choice | Yes |
| 5 | Which network? | Mainnet / Testnet | Yes |
| 6 | How easy was it to get paid? | Linear scale 1–5 | Yes |
| 7 | How easy was it to pay? | Linear scale 1–5 | No |
| 8 | Would you use this for real money? | Yes / No / Not yet | Yes |
| 9 | What stopped you, or nearly stopped you? | Paragraph | No |
| 10 | What would you need before charging a real customer with it? | Paragraph | No |

Question 9 is the one that changes the roadmap. Keep it.

Turn on **Collect email addresses** and **Limit to 1 response**.

## Exporting

Responses → the Sheets icon → **File → Download → Microsoft Excel (.xlsx)**.
Save it here as `responses.xlsx` and commit it.
`responses-template.csv` has the exact headers Google Sheets produces.

## Counting a user

A form response is a claim. It counts as a verified user only when the wallet
address also appears in the registry's on-chain events:

```bash
stellar events --network mainnet --start-ledger <LEDGER> \
  --id <CONTRACT_ID> --output json | grep <WALLET_ADDRESS>
```

Record the verified count in `docs/growth.md`, not here.

## Closing the loop

Every theme that appears more than once becomes an issue, then a commit, then a
row in the growth report's *What shipped* table. A feedback section with no
commit links behind it is a promise, not a changelog.
