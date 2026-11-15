// Ссылка на PDF с бланками без заголовка входа (Telegram скачивает файл сам): заказы, вид бланка,
// пробная печать и срок — подписаны HMAC от токена бота. Живёт 10 минут.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { BlankKind } from "./data.ts";

const TTL_SEC = 600;
const CODE = /^[A-Z0-9]{6}$/;

export type FormsLink = { codes: string[]; kind: BlankKind; test: boolean };

function sign(parts: string[], secret: string): string {
  return createHmac("sha256", `crm-post-forms:${secret}`).update(parts.join("|")).digest("hex");
}

export function signFormsLink(l: FormsLink, secret: string, nowSec: number): string {
  const c = l.codes.join(",");
  const e = String(nowSec + TTL_SEC);
  const t = l.test ? "1" : "0";
  return new URLSearchParams({ c, k: l.kind, t, e, s: sign([c, l.kind, t, e], secret) }).toString();
}

export function verifyFormsLink(p: URLSearchParams, secret: string, nowSec: number): FormsLink | null {
  const c = p.get("c") ?? "";
  const k = p.get("k") ?? "";
  const t = p.get("t") ?? "";
  const e = p.get("e") ?? "";
  const s = p.get("s") ?? "";
  const codes = c ? c.split(",") : [];
  if (codes.length > 100 || !codes.every((x) => CODE.test(x))) return null;
  if ((k !== "ramburs" && k !== "tfp3") || (t !== "0" && t !== "1") || !/^\d+$/.test(e) || !/^[0-9a-f]{64}$/.test(s)) return null;
  if (Number(e) < nowSec) return null;
  if (!timingSafeEqual(Buffer.from(sign([c, k, t, e], secret), "hex"), Buffer.from(s, "hex"))) return null;
  return { codes, kind: k, test: t === "1" };
}
