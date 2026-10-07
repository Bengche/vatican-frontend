"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname } from "next/navigation";
import { BrandMark } from "./Logo";
import { SHOW_INSTALL_EVENT, requestInstall, useInstall } from "@/lib/pwa";
import { brand } from "@/config/brand";

const DISMISS_KEY = "pwa-install-dismissed-until";
const DISMISS_DAYS = 14;
const INSTALL_ROUTES = ["/", "/dashboard", "/my-bookings"];

const subscribeOnline = (listener: () => void) => {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
};

function ShareIcon() {
  return (
    <svg
      className="mx-0.5 inline h-4 w-4 -translate-y-px"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path d="M12 3v12M8 7l4-4 4 4M6 12v7a1 1 0 001 1h10a1 1 0 001-1v-7" />
    </svg>
  );
}

export default function PwaProvider() {
  const pathname = usePathname();
  const { canInstall, ios } = useInstall();
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );

  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [ready, setReady] = useState(false);
  const [forced, setForced] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const registered = useRef(false);

  // Register the service worker in production only, and surface updates instead of forcing them.
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator) ||
      registered.current
    )
      return;
    registered.current = true;

    // The first install claims the page silently; only a replaced worker needs a reload.
    const hadController = Boolean(navigator.serviceWorker.controller);
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing || !hadController) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller)
          setWaiting(registration.waiting);

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            )
              setWaiting(worker);
          });
        });

        const check = () => registration.update().catch(() => {});
        const interval = window.setInterval(check, 30 * 60 * 1000);
        document.addEventListener(
          "visibilitychange",
          () => document.visibilityState === "visible" && check(),
        );
        window.addEventListener(
          "beforeunload",
          () => window.clearInterval(interval),
          { once: true },
        );
      })
      .catch(() => {});
  }, []);

  // Offer installation after a short while, never on first paint and not again for two weeks after "Not now".
  useEffect(() => {
    const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
    const timer = window.setTimeout(() => {
      setDismissed(until > Date.now());
      setReady(true);
    }, 12_000);
    const show = () => setForced(true);
    window.addEventListener(SHOW_INSTALL_EVENT, show);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(SHOW_INSTALL_EVENT, show);
    };
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(
      DISMISS_KEY,
      String(Date.now() + DISMISS_DAYS * 86_400_000),
    );
    setDismissed(true);
    setForced(false);
  }, []);

  const showInstall =
    canInstall &&
    (forced || (ready && !dismissed && INSTALL_ROUTES.includes(pathname)));

  return (
    <>
      {!online && pathname !== "/offline" && (
        <div
          role="status"
          className="fixed inset-x-0 z-[60] flex justify-center px-4"
          style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <p className="rounded-full border border-white/15 bg-primary-dark px-4 py-2 text-xs font-medium text-white shadow-lg">
            You are offline. Saved tickets are still available.
          </p>
        </div>
      )}

      {waiting && (
        <div
          role="status"
          className="fixed inset-x-4 z-[60] mx-auto flex max-w-md items-center justify-between gap-4 rounded-xl border border-white/10 bg-primary-dark px-4 py-3 text-white shadow-2xl"
          style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <p className="text-sm">A new version is ready.</p>
          <button
            type="button"
            className="btn btn-accent btn-sm shrink-0"
            onClick={() => waiting.postMessage({ type: "SKIP_WAITING" })}
          >
            Update
          </button>
        </div>
      )}

      {showInstall && !waiting && online && (
        <aside
          aria-label={`Install ${brand.name}`}
          className="fixed inset-x-4 z-[55] mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-6 sm:mx-0"
          style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-start gap-3.5">
            <BrandMark size={44} framed />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">
                Install {brand.name}
              </p>
              {ios ? (
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Tap <ShareIcon /> in Safari, then{" "}
                  <strong>Add to Home Screen</strong>. Book faster and keep your
                  tickets on your phone.
                </p>
              ) : (
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Add the app to your home screen to book faster and keep your
                  tickets available offline.
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={dismiss}
            >
              {ios ? "Got it" : "Not now"}
            </button>
            {!ios && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={async () => {
                  const outcome = await requestInstall();
                  if (outcome !== "accepted") dismiss();
                }}
              >
                Install
              </button>
            )}
          </div>
        </aside>
      )}
    </>
  );
}
