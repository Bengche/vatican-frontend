import Image from "next/image";
import { brand } from "@/config/brand";

// Artwork lives in public/logo-mark.png; replace that file to change the mark.
export function BrandMark({ size = 46, framed = false }: { size?: number; framed?: boolean }) {
  const image = (
    <Image
      src="/logo-mark.png"
      alt={brand.name}
      width={Math.round(size * 1.0875)}
      height={size}
      priority
      className="shrink-0"
    />
  );
  if (!framed) return image;
  return <span className="flex shrink-0 items-center justify-center rounded-lg bg-primary-dark p-1.5">{image}</span>;
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
      <BrandMark framed={!light} />
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