// Decorative route line used behind hero panels: flat, no gradients.
export default function RouteMotif({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 600 420"
      fill="none"
      preserveAspectRatio="xMaxYMid meet"
      className={`pointer-events-none ${className}`}
    >
      <path
        d="M30 352C118 352 142 262 232 244S334 286 402 200S486 96 536 72"
        stroke="rgba(255,255,255,0.10)"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M30 352C118 352 142 262 232 244S334 286 402 200S486 96 536 72"
        stroke="var(--brand-accent)"
        strokeOpacity="0.75"
        strokeWidth="1.5"
        strokeDasharray="1 8"
        strokeLinecap="round"
      />
      {[
        [30, 352],
        [232, 244],
        [402, 200],
      ].map(([cx, cy]) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r="6"
          fill="var(--brand-primary)"
          stroke="var(--brand-accent)"
          strokeWidth="1.5"
        />
      ))}
      <circle
        cx="536"
        cy="72"
        r="14"
        fill="var(--brand-primary)"
        stroke="var(--brand-accent)"
        strokeWidth="1.5"
      />
      <circle cx="536" cy="72" r="4.5" fill="var(--brand-accent)" />
    </svg>
  );
}
