import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import { brand } from "@/config/brand";

export default function LegalPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            Last updated {brand.legalUpdated}
          </p>
          {intro && (
            <p className="mt-6 text-base leading-7 text-slate-600">{intro}</p>
          )}
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-10">
            {children}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9 first:mt-0">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-slate-600 [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}