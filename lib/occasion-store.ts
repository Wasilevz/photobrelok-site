"use client";

import { useSyncExternalStore, useCallback } from "react";

const KEY = "photobrelok_occasion";
const EV = "photobrelok_occasion_change";

function read(): string {
  try {
    return window.localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EV, cb);
  return () => window.removeEventListener(EV, cb);
}

function snap() {
  return read();
}

export function useOccasion() {
  const occasion = useSyncExternalStore(subscribe, snap, () => "");
  const setOccasion = useCallback((v: string) => {
    try {
      if (v) window.localStorage.setItem(KEY, v);
      else window.localStorage.removeItem(KEY);
    } catch { /* ignore */ }
    window.dispatchEvent(new Event(EV));
  }, []);
  return { occasion, setOccasion };
}
