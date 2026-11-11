// Источник визита (utm, fbclid, внешний реферер) хранится только на время сессии вкладки
// и уходит в заказ одной строкой для менеджера. Персональных данных здесь нет.
const KEY = "photobrelok_src";

// Подчёркивание заменяем на дефис: сервер оставляет в тексте только буквы, цифры и простые знаки
const clean = (v: string | null, max = 40) =>
  (v ?? "").replace(/_/g, "-").replace(/[^\p{L}\p{N}\s\-.]/gu, "").trim().slice(0, max);

/** Вызывать один раз при загрузке страницы: запоминает первый источник визита. */
export function captureSource(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.sessionStorage.getItem(KEY)) return;
    const q = new URLSearchParams(window.location.search);
    const parts = [clean(q.get("utm_source")), clean(q.get("utm_medium")), clean(q.get("utm_campaign"))].filter(Boolean);
    if (parts.length === 0 && q.get("fbclid")) parts.push("реклама Meta (fbclid)");
    if (parts.length === 0 && document.referrer) {
      const host = new URL(document.referrer).hostname.replace(/^www\./, "");
      if (host && host !== window.location.hostname.replace(/^www\./, "")) parts.push(`переход с ${clean(host)}`);
    }
    if (parts.length > 0) window.sessionStorage.setItem(KEY, parts.join(" / "));
  } catch {
    // sessionStorage недоступен или referrer некорректен: источник просто не запоминаем
  }
}

export function readSource(): string | undefined {
  try {
    return window.sessionStorage.getItem(KEY) || undefined;
  } catch {
    return undefined;
  }
}
