import { useEffect, useState } from "react";
import { StrKey } from "tally-client";

import { client } from "../lib/tally";

const KINDS = [
  {
    name: "Invoice",
    line: "One payment at a price you set. Closes itself once it is paid.",
  },
  {
    name: "Limited sale",
    line: "Tickets, seats or units. Stops when the last one sells.",
  },
  {
    name: "Collection",
    line: "Any amount, any number of times. A tip jar or a donation page.",
  },
];

interface WelcomeProps {
  readonly canConnect: boolean;
  readonly onConnect: () => void;
}

/**
 * The front door. Someone arriving here has usually just followed a payment
 * link and come back to look around, so it answers "what is this and what
 * would I get" before asking for a wallet.
 */
export function Welcome({ canConnect, onConnect }: WelcomeProps) {
  const [links, setLinks] = useState<bigint>();
  const [lookup, setLookup] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    client()
      .link_count()
      .then((tx) => setLinks(tx.result))
      .catch(() => undefined);
  }, []);

  function view(event: React.FormEvent) {
    event.preventDefault();
    const address = lookup.trim();
    if (!StrKey.isValidEd25519PublicKey(address)) {
      setError("That is not a Stellar address. They start with G.");
      return;
    }
    window.location.search = `?merchant=${address}`;
  }

  return (
    <div className="welcome">
      <div className="panel welcome-main">
        <h2>Turn a price into a link.</h2>
        <p className="lead">
          Create a link, send it to whoever is paying, and the money arrives in your
          wallet. Tally records the payment and never holds it — there is nothing to
          withdraw and nothing for us to lose.
        </p>

        <ul className="kinds">
          {KINDS.map((kind) => (
            <li key={kind.name}>
              <strong>{kind.name}</strong>
              <span className="muted">{kind.line}</span>
            </li>
          ))}
        </ul>

        <div className="actions">
          <button className="button" data-kind="primary" disabled={!canConnect} onClick={onConnect}>
            {canConnect ? "Connect wallet to start" : "Freighter not found"}
          </button>
          {!canConnect && (
            <a className="button" href="https://freighter.app" target="_blank" rel="noreferrer">
              Get Freighter
            </a>
          )}
        </div>
        {links !== undefined && (
          <p className="hint">
            {String(links)} payment {links === 1n ? "link has" : "links have"} been created
            through this registry.
          </p>
        )}
      </div>

      <form className="panel welcome-lookup" onSubmit={view}>
        <h3>Look up a merchant</h3>
        <p className="muted">
          Every merchant's record is public on chain. Paste an address to see their links
          and what they have collected — no wallet needed.
        </p>
        <label className="field">
          <span>Stellar address</span>
          <input
            value={lookup}
            onChange={(event) => {
              setLookup(event.target.value);
              setError(undefined);
            }}
            placeholder="G…"
            spellCheck={false}
          />
        </label>
        {error && (
          <p className="notice" data-tone="error">
            {error}
          </p>
        )}
        <button className="button" type="submit">
          View record
        </button>
      </form>
    </div>
  );
}
