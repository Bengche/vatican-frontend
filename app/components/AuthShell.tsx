import Link from "next/link";
import Logo from "./Logo";
import { brand } from "@/config/brand";

export default function AuthShell({ title, subtitle, children, wide = false }: { title: string; subtitle: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-primary text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(70%_60%_at_100%_0%,color-mix(in_srgb,var(--brand-accent)_24%,transparent),transparent),linear-gradient(180deg,var(--brand-primary-dark),var(--brand-primary))]"
        />
        <Link href="/" className="relative">
          <Logo />
        </Link>
        <div className="relative max-w-md">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">{brand.hero.eyebrow}</p>
          <p className="mt-4 text-3xl font-extrabold leading-tight tracking-tight">{brand.hero.title}</p>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">{brand.hero.subtitle}</p>
        </div>
        <p className="relative text-xs text-slate-400">&copy; {new Date().getFullYear()} {brand.legalName}</p>
      </aside>

      <main className="flex flex-col justify-center px-4 py-10 sm:px-8">
        <div className={`mx-auto w-full ${wide ? "max-w-lg" : "max-w-md"}`}>
          <Link href="/" className="mb-8 inline-block lg:hidden">
            <Logo tone="dark" subtitle="" />
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
