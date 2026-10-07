import Link from "next/link";
import Logo from "./Logo";
import RouteMotif from "./RouteMotif";
import { brand } from "@/config/brand";

export default function AuthShell({
  title,
  subtitle,
  children,
  wide = false,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-primary text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <RouteMotif className="absolute bottom-0 right-0 h-3/5 w-full opacity-70" />
        <Link href="/" className="relative">
          <Logo />
        </Link>
        <div className="relative max-w-md">
          <p className="font-display text-4xl font-medium leading-[1.12] tracking-[-0.015em]">
            {brand.hero.title}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            {brand.hero.subtitle}
          </p>
        </div>
        <p className="relative text-xs text-slate-400">
          &copy; {new Date().getFullYear()} {brand.legalName}
        </p>
      </aside>

      <main className="flex flex-col justify-center px-4 py-10 sm:px-8">
        <div className={`mx-auto w-full ${wide ? "max-w-lg" : "max-w-md"}`}>
          <Link href="/" className="mb-8 inline-block lg:hidden">
            <Logo tone="dark" subtitle="" />
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
