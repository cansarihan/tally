# Deployment

## Prerequisites

```bash
rustup target add wasm32v1-none
cargo install --locked stellar-cli
npm ci
```

## What it costs

Measured on testnet; mainnet resource fees use the same formula.

| Operation | Fee |
| --- | --- |
| Deploy the registry (14 KB wasm) | ~10 XLM |
| Create a payment link | ~0.09 XLM |
| Pay a link | ~0.03 XLM |

Nearly all of the deploy cost is rent on the wasm entry and scales with
contract size. Everyday use is fractions of a cent. Budget ~12 XLM for a
mainnet deploy with headroom for a retry.

One registry serves every merchant, so this is paid once — not per seller.

## Testnet

```bash
stellar keys generate --network testnet --fund my-key
./scripts/deploy.sh testnet my-key
```

Then confirm what is deployed is what is in this repository:

```bash
./scripts/build.sh                                       # prints the local hash
stellar contract fetch --id <CONTRACT_ID> --network testnet --out-file /tmp/c.wasm
shasum -a 256 /tmp/c.wasm                                # must match
```

The hashes only agree because `rust-toolchain.toml` pins the exact compiler and
CI installs a pinned `stellar-cli` release. The contract's metadata records
both versions, so an unpinned toolchain silently produces a different hash for
identical source.

## Mainnet

```bash
stellar keys add tally-deployer --secret-key    # paste the secret; never commit it
./scripts/deploy.sh mainnet tally-deployer
```

The script requires you to type `deploy mainnet` before it proceeds. Record the
contract id, verify the hash as above, then **create one link and pay it with a
small amount** before announcing anything. A registry you have not taken a
payment through is a registry you have not tested.

## Publishing the app

Set the contract id and network at build time:

```
VITE_CONTRACT_ID=C...
VITE_NETWORK=mainnet
```

**Vercel.** Import the repository, set the root directory to `web`, add the two
variables above, and deploy. `vercel.json` already rewrites every path to
`index.html` so `/pay/42` resolves.

**GitHub Pages.** The included workflow deploys on every push to `main`. Set
`VITE_CONTRACT_ID` and `VITE_NETWORK` as repository variables under Settings →
Secrets and variables → Actions, and enable Pages with source "GitHub Actions".

Pages has one flaw that matters for this product: it cannot rewrite unknown
paths, only serve a copied `404.html`. A payment link therefore *renders*
correctly but answers **HTTP 404**, and messaging apps and crawlers read that
status when they build a link preview. Use Pages for a demo; use a host that
can rewrite for links you actually send to customers.

**Anywhere else.** `npm run build --workspace web` produces a static `web/dist`.
The host must rewrite unknown paths to `index.html`, or payment links will 404.

## Keeping the registry alive

Every entry point extends the contract's instance TTL, so a registry in regular
use never archives. One left untouched for months may need
`stellar contract restore` before the next call. No funds are at risk either
way, because none are held.

## There is no upgrade path

The contract cannot be upgraded and has no admin. To ship new logic, deploy a
new registry and point the app at it. Existing links keep working against the
old one, so the two can run side by side and old links never break.
