import { brand } from "@/config/brand";

export function BrandMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const box = size === "lg" ? "h-12 w-12 text-lg rounded-xl" : size === "sm" ? "h-8 w-8 text-xs rounded-lg" : "h-10 w-10 text-sm rounded-xl";
  return (
    <span className={`flex shrink-0 items-center justify-center bg-accent font-extrabold tracking-tight text-primary-dark ${box}`}>
      {brand.monogram}
    </span>
  );
}

export default function Logo({ tone = "light", subtitle = brand.tagline }: { tone?: "light" | "dark"; subtitle?: string }) {
  const light = tone === "light";
  return (
    <span className="flex items-center gap-3">
      <BrandMark />
      <span className="flex flex-col leading-tight">
        <span className={`text-[15px] font-extrabold uppercase tracking-wide ${light ? "text-white" : "text-primary"}`}>
          {brand.name}
        </span>
        {subtitle && (
          <span className={`hidden text-[11px] sm:block ${light ? "text-slate-400" : "text-slate-500"}`}>{subtitle}</span>
        )}
      </span>
    </span>
  );
}
