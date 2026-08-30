import type { Link } from "tally-client";

import { formatAmount, relativeTime } from "../lib/format";
import { useToken } from "../lib/hooks";
import { STATE_LABELS, fillRatio, linkKind, linkState } from "../lib/status";

interface LinkTableProps {
  readonly links: readonly Link[];
  readonly now: number;
  readonly busy: boolean;
  readonly onCopy: (link: Link) => void;
  readonly onClose: (link: Link) => void;
  readonly onSelect: (link: Link) => void;
  /** True when the viewer supplied an address but cannot sign for it. */
  readonly readOnly?: boolean;
}

export function LinkTable({
  links,
  now,
  busy,
  onCopy,
  onClose,
  onSelect,
  readOnly,
}: LinkTableProps) {
  return (
    <div className="panel">
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Link</th>
              <th>Type</th>
              <th className="num">Price</th>
              <th>Status</th>
              <th>Taken</th>
              <th className="num">Collected</th>
              <th className="num">Expires</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {links.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={8}>No links yet. Create one to start taking payments.</td>
              </tr>
            ) : (
              links.map((link) => (
                <Row
                  key={String(link.id)}
                  link={link}
                  now={now}
                  busy={busy}
                  onCopy={onCopy}
                  onClose={onClose}
                  onSelect={onSelect}
                  readOnly={readOnly}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface RowProps extends Omit<LinkTableProps, "links"> {
  readonly link: Link;
}

function Row({ link, now, busy, onCopy, onClose, onSelect, readOnly }: RowProps) {
  const token = useToken(link.token);
  const state = linkState(link, now);
  const fill = fillRatio(link);

  const price =
    link.amount === 0n
      ? "Any amount"
      : token
        ? `${formatAmount(link.amount, token.decimals)} ${token.symbol}`
        : "…";

  return (
    <tr onClick={() => onSelect(link)} style={{ cursor: "pointer" }}>
      <td className="mono">#{String(link.id)}</td>
      <td>{linkKind(link)}</td>
      <td className="num">{price}</td>
      <td>
        <span className="pill" data-state={state}>
          {STATE_LABELS[state]}
        </span>
      </td>
      <td>
        {fill === undefined ? (
          <span className="faint">{link.payments} so far</span>
        ) : (
          <span className="fill">
            <span className="fill-track">
              <span style={{ width: `${fill * 100}%` }} />
            </span>
            <span className="faint mono">
              {link.payments}/{link.max_payments}
            </span>
          </span>
        )}
      </td>
      <td className="num">
        {token ? `${formatAmount(link.collected, token.decimals)} ${token.symbol}` : "…"}
      </td>
      <td className="num faint">{relativeTime(link.expires_at, now)}</td>
      <td className="num">
        <span className="actions" onClick={(event) => event.stopPropagation()}>
          <button className="button" data-kind="ghost" onClick={() => onCopy(link)}>
            Copy
          </button>
          {state === "live" && !readOnly && (
            <button
              className="button"
              data-kind="ghost"
              disabled={busy}
              onClick={() => onClose(link)}
            >
              Close
            </button>
          )}
        </span>
      </td>
    </tr>
  );
}
