import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";

export default function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader variant="portal" />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">{children}</main>
      <SiteFooter />
    </>
  );
}
