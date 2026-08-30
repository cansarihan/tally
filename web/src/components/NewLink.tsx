import { useState } from "react";
import { StrKey } from "tally-client";

import { config } from "../lib/config";
import { parseAmount } from "../lib/format";
import { useToken } from "../lib/hooks";
import type { NewLink as NewLinkRequest } from "../lib/tally";

/**
 * The form asks what the merchant is selling, not how the contract stores it.
 * Each preset maps to a pair of fields that are allowed to be zero.
 */
type Preset = "invoice" | "product" | "collection";

const PRESETS: Record<Preset, { label: string; hint: string }> = {
  invoice: {
    label: "Invoice — one payment, fixed price",
    hint: "Closes itself once it has been paid once.",
  },
  product: {
    label: "Product — fixed price, limited quantity",
    hint: "Stops accepting payments once the quantity sells out.",
  },
  collection: {
    label: "Collection — any amount, any number of times",
    hint: "A tip jar or donation page. The payer decides what to send.",
  },
};

interface NewLinkProps {
  readonly busy: boolean;
  readonly onCreate: (request: NewLinkRequest) => void;
  readonly onCancel: () => void;
}

export function NewLink({ busy, onCreate, onCancel }: NewLinkProps) {
  const [preset, setPreset] = useState<Preset>("invoice");
  const [token, setToken] = useState<string>(config.nativeToken);
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("10");
  const [days, setDays] = useState("30");
  const [error, setError] = useState<string>();

  const info = useToken(token);
  const wantsPrice = preset !== "collection";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      onCreate(build());
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  function build(): NewLinkRequest {
    if (!StrKey.isValidContract(token)) {
      throw new Error("Enter a valid token contract address (C…)");
    }
    if (!info) throw new Error("Still reading the token's decimals — try again shortly");

    const lifetime = Number(days);
    if (!Number.isInteger(lifetime) || lifetime < 1 || lifetime > 365) {
      throw new Error("Choose between 1 and 365 days");
    }

    const amount = wantsPrice ? parseAmount(price, info.decimals) : 0n;
    const maxPayments =
      preset === "invoice" ? 1 : preset === "product" ? requireQuantity(quantity) : 0;

    return { token, amount, maxPayments, lifetime: BigInt(lifetime * 86_400) };
  }

  return (
    <form className="panel" style={{ padding: 18 }} onSubmit={submit}>
      <label className="field">
        <span>What is this link for</span>
        <select value={preset} onChange={(event) => setPreset(event.target.value as Preset)}>
          {Object.entries(PRESETS).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <p className="hint">{PRESETS[preset].hint}</p>
      </label>

      <label className="field">
        <span>Token</span>
        <input
          value={token}
          onChange={(event) => setToken(event.target.value.trim())}
          placeholder="C…"
          spellCheck={false}
        />
        <p className="hint">
          {info ? `${info.symbol}, ${info.decimals} decimal places` : "Reading the token…"}
        </p>
      </label>

      <div className="row-2">
        {wantsPrice && (
          <label className="field">
            <span>Price</span>
            <input
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="0.00"
              inputMode="decimal"
            />
          </label>
        )}
        {preset === "product" && (
          <label className="field">
            <span>Quantity</span>
            <input
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              inputMode="numeric"
            />
          </label>
        )}
        <label className="field">
          <span>Expires after</span>
          <input
            value={days}
            onChange={(event) => setDays(event.target.value)}
            inputMode="numeric"
          />
          <p className="hint">Days. The link stops taking payments then.</p>
        </label>
      </div>

      {error && (
        <p className="notice" data-tone="error">
          {error}
        </p>
      )}

      <div className="actions">
        <button className="button" data-kind="primary" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create link"}
        </button>
        <button className="button" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function requireQuantity(value: string): number {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 4_294_967_295) {
    throw new Error("Quantity must be a whole number of at least 1");
  }
  return quantity;
}
