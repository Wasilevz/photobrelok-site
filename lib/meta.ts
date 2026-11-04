export const META_PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID || "1105507679034438";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
    _fbqLoaded?: boolean;
  }
}

/**
 * Подключает настоящий пиксель Meta. Вызывать только после согласия
 * на маркетинг: до этого ни запроса к connect.facebook.net, ни cookie.
 */
export function loadMetaPixel(): void {
  if (typeof window === "undefined" || window._fbqLoaded) return;
  window._fbqLoaded = true;

  type FbqFn = ((...args: unknown[]) => void) & {
    queue: unknown[][];
    callMethod?: (...args: unknown[]) => void;
    loaded: boolean;
    version: string;
  };

  const fbq = function (this: unknown, ...args: unknown[]) {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
    } else {
      fbq.queue.push(args);
    }
  } as unknown as FbqFn;

  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";
  window.fbq = fbq as unknown as (...args: unknown[]) => void;
  window._fbq = fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  fbq("init", META_PIXEL_ID);
  fbq("track", "PageView");
}
