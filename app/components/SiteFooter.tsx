import Link from "next/link";
import Logo from "./Logo";
import { brand } from "@/config/brand";

export default function SiteFooter() {
  return (
    <footer
      id="contact"
      className="mt-auto border-t border-white/10 bg-primary-dark text-slate-300"
    >
      <div className="mx-auto max-w-7xl px-4 pt-12 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <Logo subtitle="" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
              {brand.about}
            </p>
          </div>

          <div className="md:col-span-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-white">
              Travel
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/dashboard" className="hover:text-white">
                  Book a ticket
                </Link>
              </li>
              <li>
                <Link href="/my-bookings" className="hover:text-white">
                  My tickets
                </Link>
              </li>
              <li>
                <Link href="/#terminals" className="hover:text-white">
                  Terminals
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-white">
                  Sign in
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-white">
              Customer care
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <a
                  href={`tel:${brand.support.phoneHref}`}
                  className="font-semibold text-white hover:text-accent"
                >
                  {brand.support.phone}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${brand.support.email}`}
                  className="hover:text-white"
                >
                  {brand.support.email}
                </a>
              </li>
              <li className="text-slate-400">{brand.support.hours}</li>
              <li className="text-slate-400">{brand.headOffice}</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {brand.legalName}. All rights
            reserved.
          </p>
          <p>Payments by {brand.payments}</p>
        </div>
      </div>
    </footer>
  );
}
