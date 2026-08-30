import type { Payment } from "tally-client";

import { explorerAccount } from "../lib/config";
import { formatAmount, formatDate, shortAddress } from "../lib/format";
import { useToken } from "../lib/hooks";

interface PaymentTableProps {
  readonly payments: readonly Payment[];
  readonly token: string;
}

/** A statement view: newest at the top, amounts right-aligned in tabular figures. */
export function PaymentTable({ payments, token }: PaymentTableProps) {
  const info = useToken(token);
  const newestFirst = [...payments].reverse();

  return (
    <div className="panel">
      <div className="scroller">
        <table>
          <thead>
            <tr>
              <th>Received</th>
              <th>From</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {newestFirst.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={3}>Nobody has paid this link yet.</td>
              </tr>
            ) : (
              newestFirst.map((payment, index) => (
                <tr key={`${payment.at}-${index}`}>
                  <td className="muted">{formatDate(payment.at)}</td>
                  <td>
                    <a
                      className="mono"
                      href={explorerAccount(payment.payer)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortAddress(payment.payer)}
                    </a>
                  </td>
                  <td className="num">
                    {info ? `${formatAmount(payment.amount, info.decimals)} ${info.symbol}` : "…"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
