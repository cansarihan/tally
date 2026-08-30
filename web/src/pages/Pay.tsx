import { useEffect, useState } from "react";
import type { Link } from "tally-client";

import { Mark } from "../components/Mark";
import { explorerAccount, explorerTx } from "../lib/config";
import { formatAmount, parseAmount, relativeTime, shortAddress } from "../lib/format";
import { useNow, useToken } from "../lib/hooks";
import { remaining } from "../lib/remaining";
import { STATE_LABELS, linkState } from "../lib/status";
import * as tally from "../lib/tally";
import { connect, currentAddress, walletAvailable } from "../lib/wallet";

/**
 * The page a customer sees. It is the only surface most people will ever meet,
 * so it says what they are paying, to whom, and nothing else — no navigation,
 * no dashboard, no jargon about contracts.
 */
export function Pay({ id }: { readonly id: bigint }) {
  const now = useNow();
  const [link, setLink] = useState<Link>();
  const [missing, setMissing] = useState(false);
  const [address, setAddress] = useState<string>();
  const [hasWallet, setHasWallet] = useState(true);
  const [amount, setAmount] = useState("");
  const [hash, setHash] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const token = useToken(link?.token);

  useEffect(() => {
    tally
      .readLink(id)
      .then(setLink)
      .catch(() => setMissing(true));
    walletAvailable().then((available) => {
      setHasWallet(available);
      if (available) currentAddress().then(setAddress);
    });
  }, [id]);

  if (missing) {
    return (
      <Shell>
        <div className="receipt-card">
          <div className="receipt-head">
            <p className="receipt-label">Payment link</p>
            <p className="receipt-amount" style={{ fontSize: "1.5rem" }}>
              Not found
            </p>
          </div>
          <div className="receipt-body">
            <p className="muted" style={{ margin: 0 }}>
              No link with this number exists. Check the address you were given.
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  if (!link || !token) {
    return (
      <Shell>
        <p className="faint">Loading…</p>
      </Shell>
    );
  }

  const state = linkState(link, now);
  const left = remaining(link);
  const fixed = link.amount > 0n;
  const due = fixed ? formatAmount(link.amount, token.decimals) : undefined;

  async function pay() {
    if (!address || !link || !token) return;
    setBusy(true);
    setError(undefined);
    try {
      const value = fixed ? link.amount : parseAmount(amount, token.decimals);
      const settlement = await tally.payLink(link.id, address, value);
      setHash(settlement.hash);
      setLink(await tally.readLink(link.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  if (hash) {
    return (
      <Shell>
        <div className="receipt-card">
          <div className="receipt-head">
            <p className="receipt-label">Paid</p>
            <p className="receipt-amount">
              {due ?? amount}
              <small>{token.symbol}</small>
            </p>
          </div>
          <div className="receipt-body">
            <dl>
              <div className="detail">
                <dt>To</dt>
                <dd className="mono">{shortAddress(link.merchant)}</dd>
              </div>
              <div className="detail">
                <dt>Reference</dt>
                <dd className="mono">#{String(link.id)}</dd>
              </div>
            </dl>
            <p className="receipt-foot">
              <a href={explorerTx(hash)} target="_blank" rel="noreferrer">
                View this payment on the network
              </a>
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="receipt-card">
        <div className="receipt-head">
          <p className="receipt-label">Payment requested by</p>
          <p className="mono">
            <a href={explorerAccount(link.merchant)} target="_blank" rel="noreferrer">
              {shortAddress(link.merchant)}
            </a>
          </p>
          <p className="receipt-amount">
            {due ?? "Any amount"}
            {due && <small>{token.symbol}</small>}
          </p>
        </div>

        <div className="receipt-body">
          <dl>
            <div className="detail">
              <dt>Reference</dt>
              <dd className="mono">#{String(link.id)}</dd>
            </div>
            <div className="detail">
              <dt>Status</dt>
              <dd>
                <span className="pill" data-state={state}>
                  {STATE_LABELS[state]}
                </span>
              </dd>
            </div>
            {state === "live" && left !== undefined && (
              <div className="detail">
                <dt>Remaining</dt>
                <dd className={left <= 3 ? "" : "muted"}>
                  {left} of {link.max_payments}
                </dd>
              </div>
            )}
            {state === "live" && (
              <div className="detail">
                <dt>Expires</dt>
                <dd className="muted">{relativeTime(link.expires_at, now)}</dd>
              </div>
            )}
          </dl>

          {state !== "live" ? (
            <p className="notice" data-tone="error" style={{ marginTop: 14 }}>
              {state === "complete"
                ? "This link has taken all the payments it was set up to accept."
                : state === "expired"
                  ? "This link has expired and can no longer be paid."
                  : "The recipient closed this link."}
            </p>
          ) : (
            <div style={{ marginTop: 14 }}>
              {!fixed && (
                <label className="field">
                  <span>Amount in {token.symbol}</span>
                  <input
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.00"
                    inputMode="decimal"
                  />
                </label>
              )}

              {error && (
                <p className="notice" data-tone="error">
                  {error}
                </p>
              )}

              {address ? (
                <button
                  className="button"
                  data-kind="primary"
                  data-size="lg"
                  disabled={busy}
                  onClick={() => void pay()}
                >
                  {busy ? "Confirming…" : `Pay ${due ?? (amount || "…")} ${token.symbol}`}
                </button>
              ) : (
                <button
                  className="button"
                  data-kind="primary"
                  data-size="lg"
                  disabled={!hasWallet}
                  onClick={() =>
                    connect()
                      .then(setAddress)
                      .catch((cause) => setError(describe(cause)))
                  }
                >
                  {hasWallet ? "Connect wallet to pay" : "Freighter not found"}
                </button>
              )}

              <p className="receipt-foot">
                Your payment goes directly to the recipient. Nothing is held in between.
              </p>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="checkout">
      <div className="receipt">
        <div
          className="brand"
          style={{ justifyContent: "center", marginBottom: 16, color: "var(--brand)" }}
        >
          <Mark />
          Tally
        </div>
        {children}
      </div>
    </div>
  );
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
