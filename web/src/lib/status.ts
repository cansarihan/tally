import type { Link } from "tally-client";

/** What a link is doing right now, in the words a merchant would use. */
export type LinkState = "live" | "complete" | "expired" | "closed";

export const STATE_LABELS: Record<LinkState, string> = {
  live: "Live",
  complete: "Complete",
  expired: "Expired",
  closed: "Closed",
};

/**
 * Derived rather than stored: a link that filled up or ran out of time is
 * still `Open` on chain, because nothing had to write to it for that to
 * become true.
 */
export function linkState(link: Link, now: number): LinkState {
  if (link.status.tag === "Closed") return "closed";
  if (link.max_payments > 0 && link.payments >= link.max_payments) return "complete";
  if (now > Number(link.expires_at)) return "expired";
  return "live";
}

export const isPayable = (link: Link, now: number) => linkState(link, now) === "live";

/** How a link was set up, which is what a merchant named it in their head. */
export function linkKind(link: Link): string {
  const fixed = link.amount > 0n;
  if (fixed && link.max_payments === 1) return "Invoice";
  if (fixed && link.max_payments > 1) return "Limited sale";
  if (fixed) return "Product";
  return link.max_payments === 1 ? "Open invoice" : "Open collection";
}

/** Progress toward capacity, or undefined when the link has no cap. */
export function fillRatio(link: Link): number | undefined {
  if (link.max_payments === 0) return undefined;
  return Math.min(1, link.payments / link.max_payments);
}
