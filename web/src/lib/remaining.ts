import type { Link } from "tally-client";

/**
 * How many payments a capped link will still accept, or undefined when it has
 * no cap. A buyer looking at a limited sale wants the number, not a ratio.
 */
export function remaining(link: Link): number | undefined {
  if (link.max_payments === 0) return undefined;
  return Math.max(0, link.max_payments - link.payments);
}
