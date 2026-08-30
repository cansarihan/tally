/** The tally mark: four strokes and the fifth laid across them. */
export function Mark({ size = 20 }: { readonly size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <g stroke="currentColor" strokeWidth={3} strokeLinecap="round" fill="none">
        <path d="M7 7v18M13 7v18M19 7v18M25 7v18" />
        <path d="M4.5 24 L27.5 8" stroke="var(--positive)" />
      </g>
    </svg>
  );
}
