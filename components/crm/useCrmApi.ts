"use client";

// Связь интерфейса CRM с Telegram Mini App и API /api/crm/*.
import { useCallback, useEffect, useRef, useState } from "react";
import type { CrmOrder, OrderPatch } from "@/lib/crm/model";

type TgWebApp = {
  initData: string;
  initDataUnsafe?: { start_param?: string };
  version?: string;
  ready?: () => void;
  expand?: () => void;
  isVersionAtLeast?: (v: string) => boolean;
  downloadFile?: (params: { url: string; file_name: string }, cb?: (accepted: boolean) => void) => void;
  openLink?: (url: string) => void;
  openTelegramLink?: (url: string) => void;
  showAlert?: (message: string) => void;
  showConfirm?: (message: string, cb: (ok: boolean) => void) => void;
  HapticFeedback?: { notificationOccurred?: (type: "success" | "error" | "warning") => void };
  BackButton?: { show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

export function webApp(): TgWebApp | undefined {
  return typeof window === "undefined" ? undefined : window.Telegram?.WebApp;
}

/**
 * Подпись входа Telegram. Telegram кладёт её и в адрес страницы (#tgWebAppData=…) — берём оттуда сразу,
 * не дожидаясь telegram-web-app.js (на компьютере он бывает медленным). Запоминаем при первой загрузке:
 * скрипт Telegram потом может очистить адрес.
 */
const HASH_INIT_DATA = (() => {
  if (typeof window === "undefined") return "";
  try {
    return new URLSearchParams(window.location.hash.slice(1)).get("tgWebAppData") ?? "";
  } catch {
    return "";
  }
})();

export function initData(): string {
  return webApp()?.initData || HASH_INIT_DATA;
}

type CrmComment = { authorName: string; text: string; createdAt: string };
type CrmHistoryItem = { actorName: string; action: string; details: Record<string, unknown>; createdAt: string };
export type OrderDetails = { order: CrmOrder; comments: CrmComment[]; history: CrmHistoryItem[] };

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      "X-Telegram-Init-Data": initData(),
      ...init.headers,
    },
  });
  const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new ApiError(json?.error ?? "Ошибка сети, попробуйте ещё раз", res.status);
  return json as T;
}

export function patchOrder(code: string, patch: OrderPatch) {
  return api<{ order: CrmOrder; warnings: string[] }>(`/api/crm/orders/${code}`, { method: "PATCH", body: JSON.stringify(patch) });
}

/**
 * Список заказов с опросом каждые 20 секунд, пока вкладка видима. track(promise) — пока идёт сохранение,
 * ответы опроса не применяются (иначе заказ на секунду «прыгает» обратно в старую колонку).
 */
export function useOrders(query: string, doneDays: number, enabled: boolean) {
  const [orders, setOrders] = useState<CrmOrder[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const seq = useRef(0);
  const saving = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const params = new URLSearchParams({ doneDays: String(doneDays) });
      if (query.trim()) params.set("q", query.trim());
      const data = await api<{ orders: CrmOrder[] }>(`/api/crm/orders?${params}`);
      if (mine !== seq.current || saving.current > 0) return; // устаревший ответ или идёт сохранение
      setOrders(data.orders);
      setError(null);
    } catch (e) {
      if (mine === seq.current) setError(e instanceof ApiError ? e : new ApiError("Ошибка сети", 0));
    }
  }, [query, doneDays]);

  const track = useCallback(async <T,>(work: Promise<T>): Promise<T> => {
    saving.current++;
    try {
      return await work;
    } finally {
      saving.current--;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const first = setTimeout(reload, query ? 250 : 0); // поиск — с небольшой задержкой
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, 20_000);
    const onVisible = () => document.visibilityState === "visible" && void reload();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload, query, enabled]);

  return { orders, setOrders, error, reload, track };
}

/** «Нажал — сохранил»: родной диалог сохранения Telegram, на старых клиентах — открыть ссылку. */
export function saveFile(url: string, fileName: string): void {
  const tg = webApp();
  if (tg?.downloadFile && tg.isVersionAtLeast?.("8.0")) {
    tg.downloadFile({ url, file_name: fileName });
  } else if (tg?.openLink) {
    tg.openLink(url);
  } else {
    window.open(url, "_blank", "noopener");
  }
}

export async function downloadPdf(code: string): Promise<void> {
  const { url, fileName } = await api<{ url: string; fileName: string }>(`/api/crm/orders/${code}/pdf`);
  saveFile(url, fileName);
}

/** Открыть сообщение в Telegram (внутри приложения; на старых клиентах — обычной ссылкой). */
export function openTelegram(url: string): void {
  const tg = webApp();
  if (tg?.openTelegramLink) tg.openTelegramLink(url);
  else if (tg?.openLink) tg.openLink(url);
  else window.open(url, "_blank", "noopener");
}

/** Подтверждение: окно Telegram, вне Telegram — обычный confirm. */
export function confirmDialog(message: string): Promise<boolean> {
  const tg = webApp();
  if (tg?.showConfirm && tg.isVersionAtLeast?.("6.2")) return new Promise((resolve) => tg.showConfirm!(message, resolve));
  return Promise.resolve(window.confirm(message));
}
