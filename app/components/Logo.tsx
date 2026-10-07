import { brand } from "@/config/brand";

// Square monogram badge. Colours and letters come from config/brand.ts.
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={brand.name}
      className="shrink-0"
    >
      <rect width="48" height="48" rx="7" fill="var(--brand-primary-dark)" />
      <rect
        x="2.5"
        y="2.5"
        width="43"
        height="43"
        rx="5"
        fill="none"
        stroke="var(--brand-accent)"
        strokeWidth="1.25"
      />
      <text
        x="24"
        y="31.5"
        textAnchor="middle"
        fontSize={brand.monogram.length > 2 ? 17 : 22}
        fontWeight="600"
        letterSpacing="0.5"
        fill="var(--brand-accent)"
        style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
      >
        {brand.monogram}
      </text>
    </svg>
  );
}

export default function Logo({
  tone = "light",
  subtitle = brand.descriptor,
}: {
  tone?: "light" | "dark";
  subtitle?: string;
}) {
  const light = tone === "light";
  return (
    <span className="flex items-center gap-3">
      <BrandMark />
      <span className="flex flex-col leading-none">
        <span
          className={`text-[13px] font-semibold uppercase tracking-[0.2em] ${light ? "text-white" : "text-primary"}`}
        >
          {brand.name}
        </span>
        {subtitle && (
          <span
            className={`mt-1.5 hidden text-[9.5px] font-medium uppercase tracking-[0.28em] sm:block ${light ? "text-slate-400" : "text-slate-500"}`}
          >
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}
