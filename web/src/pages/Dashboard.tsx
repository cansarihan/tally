import { useCallback, useEffect, useState } from "react";
import type { Link } from "tally-client";

import { LinkTable } from "../components/LinkTable";
import { Mark } from "../components/Mark";
import { NewLink } from "../components/NewLink";
import { PaymentTable } from "../components/PaymentTable";
import { SharePanel } from "../components/SharePanel";
import { ThemeToggle } from "../components/ThemeToggle";
import { StrKey } from "tally-client";

import { config, explorerAccount, explorerTx, payUrl } from "../lib/config";
import { formatAmount, shortAddress } from "../lib/format";
import { useNow, useToken } from "../lib/hooks";
import * as tally from "../lib/tally";
import { connect, currentAddress, walletAvailable } from "../lib/wallet";
import type { Payment } from "tally-client";

interface Notice {
  readonly tone: "ok" | "error";
  readonly message: string;
  readonly hash?: string;
}

/**
 * A merchant's record is public on chain, so the dashboard can render it for
 * an address supplied in the URL as well as for a connected wallet. Reading is
 * open; only the buttons that sign anything need a wallet.
 */
function merchantFromUrl(): string | undefined {
  const supplied = new URLSearchParams(window.location.search).get("merchant");
  return supplied && StrKey.isValidEd25519PublicKey(supplied) ? supplied : undefined;
}

export function Dashboard() {
  const now = useNow();
  const native = useToken(config.nativeToken);
  const [address, setAddress] = useState<string>();
  const [viewing] = useState(merchantFromUrl);
  const [hasWallet, setHasWallet] = useState(true);
  const [view, setView] = useState<tally.MerchantView>();
  const [selected, setSelected] = useState<Link>();
  const [sharing, setSharing] = useState<Link>();
  const [payments, setPayments] = useState<readonly Payment[]>([]);
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>();

  const refresh = useCallback(async (merchant: string) => {
    setView(await tally.readMerchant(merchant));
  }, []);

  useEffect(() => {
    walletAvailable().then((available) => {
      setHasWallet(available);
      if (available) currentAddress().then(setAddress);
    });
  }, []);

  const merchant = address ?? viewing;
  const canAct = address !== undefined;

  useEffect(() => {
    if (!merchant) return;
    refresh(merchant).catch((error) => setNotice({ tone: "error", message: describe(error) }));
  }, [merchant, refresh]);

  useEffect(() => {
    if (!selected) return;
    tally.readPayments(selected.id).then(setPayments).catch(() => setPayments([]));
  }, [selected]);

  async function run(label: string, work: () => Promise<tally.Settlement>) {
    if (!address) return;
    setBusy(true);
    setNotice(undefined);
    try {
      const { hash } = await work();
      setNotice({ tone: "ok", message: `${label}.`, ...(hash ? { hash } : {}) });
      setComposing(false);
      await refresh(address);
    } catch (error) {
      setNotice({ tone: "error", message: describe(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <Mark />
          Tally
        </div>

        <nav className="nav">
          <a href={config.base} aria-current="page">
            Overview
          </a>
          <a href="https://github.com/cansarihan/tally" target="_blank" rel="noreferrer">
            Documentation
          </a>
        </nav>

        <div className="sidebar-foot">
          <ThemeToggle />
          <span className="pill" data-state={config.network === "mainnet" ? "live" : "expired"}>
            {config.network}
          </span>
          {address ? (
            <a
              className="mono muted"
              href={explorerAccount(address)}
              target="_blank"
              rel="noreferrer"
            >
              {shortAddress(address)}
            </a>
          ) : (
            <button
              className="button"
              disabled={!hasWallet}
              onClick={() =>
                connect()
                  .then(setAddress)
                  .catch((error) => setNotice({ tone: "error", message: describe(error) }))
              }
            >
              {hasWallet ? "Connect wallet" : "Freighter not found"}
            </button>
          )}
        </div>
      </aside>

      <main className="content">
        <div className="page-head">
          <div>
            <h1>Overview</h1>
            <p>Create a link, share it, get paid. Money goes straight to your wallet.</p>
          </div>
          {canAct && !composing && (
            <button className="button" data-kind="primary" onClick={() => setComposing(true)}>
              New payment link
            </button>
          )}
        </div>

        {!merchant ? (
          <div className="panel" style={{ padding: 28, textAlign: "center" }}>
            <p style={{ margin: 0 }}>
              Connect a Stellar wallet to create payment links and see what you have collected.
            </p>
          </div>
        ) : (
          <>
            <dl className="metrics">
              <div className="metric">
                <dt>Collected</dt>
                <dd>
                  {view && native ? formatAmount(view.volume, native.decimals) : "—"}
                  <small>{native?.symbol ?? "XLM"}</small>
                </dd>
              </div>
              <div className="metric">
                <dt>Payment links</dt>
                <dd>{view?.totals.links ?? "—"}</dd>
              </div>
              <div className="metric">
                <dt>Payments received</dt>
                <dd>{view?.totals.payments ?? "—"}</dd>
              </div>
            </dl>

            {canAct && composing && (
              <div className="section">
                <NewLink
                  busy={busy}
                  onCreate={(request) =>
                    void run("Link created", () => tally.createLink(address, request))
                  }
                  onCancel={() => setComposing(false)}
                />
              </div>
            )}

            {notice && (
              <p className="notice" data-tone={notice.tone}>
                {notice.message}
                {notice.hash && (
                  <>
                    {" "}
                    <a href={explorerTx(notice.hash)} target="_blank" rel="noreferrer">
                      View transaction
                    </a>
                  </>
                )}
              </p>
            )}

            {sharing && (
              <SharePanel
                url={payUrl(sharing.id)}
                reference={`#${String(sharing.id)}`}
                onClose={() => setSharing(undefined)}
              />
            )}

            <section className="section">
              <div className="section-head">
                <h2>Payment links</h2>
                <span className="faint">{view?.links.length ?? 0} shown</span>
              </div>
              <LinkTable
                links={view?.links ?? []}
                now={now}
                busy={busy}
                onCopy={setSharing}
                onClose={(link) =>
                  address && void run("Link closed", () => tally.closeLink(address, link.id))
                }
                readOnly={!canAct}
                onSelect={setSelected}
              />
            </section>

            {selected && (
              <section className="section">
                <div className="section-head">
                  <h2>Payments to link #{String(selected.id)}</h2>
                  <button
                    className="button"
                    data-kind="ghost"
                    onClick={() => setSelected(undefined)}
                  >
                    Hide
                  </button>
                </div>
                <PaymentTable payments={payments} token={selected.token} />
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
