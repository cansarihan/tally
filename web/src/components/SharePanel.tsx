import { useState } from "react";

import { QrCode } from "./QrCode";

interface SharePanelProps {
  readonly url: string;
  readonly reference: string;
  readonly onClose: () => void;
}

/**
 * How a link actually reaches someone: pasted into a message, or held up on a
 * screen for them to scan. Both are one action away here.
 */
export function SharePanel({ url, reference, onClose }: SharePanelProps) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator.share === "function";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is refused in some contexts. The input below still
      // holds the URL, selected, so it can be copied by hand.
    }
  }

  return (
    <div className="panel share">
      <div className="share-head">
        <h2>Share link {reference}</h2>
        <button className="button" data-kind="ghost" onClick={onClose}>
          Done
        </button>
      </div>

      <div className="share-body">
        <div className="share-qr">
          <QrCode value={url} />
          <p className="hint">Point a phone camera at this to open the payment page.</p>
        </div>

        <div className="share-copy">
          <label className="field">
            <span>Payment link</span>
            <input value={url} readOnly onFocus={(event) => event.target.select()} />
          </label>
          <div className="actions">
            <button className="button" data-kind="primary" onClick={() => void copy()}>
              {copied ? "Copied" : "Copy link"}
            </button>
            {canShare && (
              <button
                className="button"
                onClick={() =>
                  void navigator.share({ title: `Payment ${reference}`, url }).catch(() => {})
                }
              >
                Share
              </button>
            )}
          </div>
          <p className="hint">
            Anyone with this link can pay it. It carries a price and an address, nothing private.
          </p>
        </div>
      </div>
    </div>
  );
}
