"use client";

import { useSyncExternalStore } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIosSafari = () => {
  const ua = navigator.userAgent;
  const ios =
    /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
};

export const SHOW_INSTALL_EVENT = "pwa-show-install";

/** Starts the native install prompt, or asks the install card to explain the manual steps (iPhone). */
export async function requestInstall() {
  if (deferred) {
    const prompt = deferred;
    deferred = null;
    notify();
    await prompt.prompt();
    return (await prompt.userChoice).outcome;
  }
  window.dispatchEvent(new Event(SHOW_INSTALL_EVENT));
  return "manual" as const;
}

export function useInstall() {
  const native = useSyncExternalStore(
    subscribe,
    () => deferred !== null,
    () => false,
  );
  const standalone = useSyncExternalStore(subscribe, isStandalone, () => false);
  const ios = useSyncExternalStore(subscribe, isIosSafari, () => false);

  return {
    canInstall: !standalone && (native || ios),
    native,
    ios: ios && !standalone,
    standalone,
  };
}
