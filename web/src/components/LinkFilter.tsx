import type { Link } from "tally-client";

import { STATE_LABELS, linkState, type LinkState } from "../lib/status";

export type Filter = "all" | LinkState;

const ORDER: readonly Filter[] = ["all", "live", "complete", "expired", "closed"];

/**
 * Counts every state, not just the selected one, so the tabs answer "is
 * anything expired?" without the merchant having to click through to find out.
 */
export function countByState(
  links: readonly Link[],
  now: number,
): Record<Filter, number> {
  const counts: Record<Filter, number> = {
    all: links.length,
    live: 0,
    complete: 0,
    expired: 0,
    closed: 0,
  };
  for (const link of links) counts[linkState(link, now)] += 1;
  return counts;
}

export function applyFilter(
  links: readonly Link[],
  filter: Filter,
  now: number,
): readonly Link[] {
  return filter === "all" ? links : links.filter((link) => linkState(link, now) === filter);
}

interface LinkFilterProps {
  readonly value: Filter;
  readonly counts: Record<Filter, number>;
  readonly onChange: (filter: Filter) => void;
}

export function LinkFilter({ value, counts, onChange }: LinkFilterProps) {
  return (
    <div className="tabs" role="tablist">
      {ORDER.map((filter) => (
        <button
          key={filter}
          role="tab"
          aria-selected={value === filter}
          className="tab"
          // A state nobody has is not worth a tab; "All" always stays.
          hidden={filter !== "all" && counts[filter] === 0}
          onClick={() => onChange(filter)}
        >
          {filter === "all" ? "All" : STATE_LABELS[filter]}
          <span className="tab-count">{counts[filter]}</span>
        </button>
      ))}
    </div>
  );
}
