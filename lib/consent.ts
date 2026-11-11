"use client";

import { useSyncExternalStore, useCallback } from "react";

/**
 * Хранилище согласий на cookie. Само согласие живёт в localStorage,
 * а не в cookie, — чтобы его можно было прочитать синхронно в <head>
 * до того, как браузер решит, грузить ли рекламный пиксель.
 */
export const CONSENT_KEY = "photobrelok_consent";

/** Поднимать при изменении текстов политик, чтобы показать баннер заново. */
export const CONSENT_VERSION = 1;

const CONSENT_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export interface ConsentState {
  v: number;
  analytics: boolean;
  marketing: boolean;
  ts: number;
}

const CHANGE_EVENT = "photobrelok_consent_change";

function parse(raw: string | null): ConsentState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      parsed.v !== CONSENT_VERSION ||
      typeof parsed.analytics !== "boolean" ||
      typeof parsed.marketing !== "boolean"
    ) {
      return null;
    }
    const ts = typeof parsed.ts === "number" ? parsed.ts : 0;
    if (Date.now() - ts > CONSENT_TTL_MS) return null;
    return { v: CONSENT_VERSION, analytics: parsed.analytics, marketing: parsed.marketing, ts };
  } catch {
    return null;
  }
}

let cachedRaw: string | null | undefined;
let cachedValue: ConsentState | null | undefined;

/**
 * Значение обязано быть стабильным между вызовами: useSyncExternalStore
 * сравнивает снимки через Object.is, и новый объект на каждом вызове
 * вызывает бесконечный ре-рендер.
 */
function load(): ConsentState | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(CONSENT_KEY);
  } catch {
    raw = null;
  }
  if (cachedRaw !== undefined && cachedRaw === raw) return cachedValue ?? null;
  cachedRaw = raw;
  cachedValue = parse(raw);
  return cachedValue ?? null;
}

export function readConsent(): ConsentState | null {
  return load();
}

export function writeConsent(analytics: boolean, marketing: boolean): ConsentState {
  const next: ConsentState = {
    v: CONSENT_VERSION,
    analytics,
    marketing,
    ts: Date.now(),
  };
  const raw = JSON.stringify(next);
  try {
    window.localStorage.setItem(CONSENT_KEY, raw);
    cachedRaw = raw;
  } catch {
    // Приватный режим: согласие держим в памяти вкладки, в storage ничего не пишется.
    cachedRaw = null;
  }
  cachedValue = next;
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return next;
}

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
}

function snapshot(): ConsentState | null {
  return readConsent();
}

function serverSnapshot(): ConsentState | null {
  return null;
}

export function useConsent() {
  const consent = useSyncExternalStore(subscribe, snapshot, serverSnapshot);

  const acceptAll = useCallback(() => {
    writeConsent(true, true);
  }, []);

  const acceptNecessary = useCallback(() => {
    writeConsent(false, false);
  }, []);

  const save = useCallback((analytics: boolean, marketing: boolean) => {
    writeConsent(analytics, marketing);
  }, []);

  return {
    consent,
    decided: consent !== null,
    acceptAll,
    acceptNecessary,
    save,
  };
}
