// Ссылка на PDF с бланками без заголовка входа (Telegram скачивает файл сам): список заказов + срок,
// подписанные HMAC от токена бота. Живёт 10 минут.
import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_SEC = 600;
const CODE = /^[A-Z0-9]{6}$/;

function sign(c: string, e: string, secret: string): string {
  return createHmac("sha256", `crm-post-forms:${secret}`).update(`${c}|${e}`).digest("hex");
}

export function signFormsLink(codes: string[], secret: string, nowSec: number): string {
  const c = codes.join(",");
  const e = String(nowSec + TTL_SEC);
  return new URLSearchParams({ c, e, s: sign(c, e, secret) }).toString();
}

export function verifyFormsLink(p: URLSearchParams, secret: string, nowSec: number): string[] | null {
  const c = p.get("c") ?? "";
  const e = p.get("e") ?? "";
  const s = p.get("s") ?? "";
  const codes = c.split(",");
  if (!codes.length || codes.length > 100 || !codes.every((x) => CODE.test(x)) || !/^\d+$/.test(e) || !/^[0-9a-f]{64}$/.test(s)) return null;
  if (Number(e) < nowSec) return null;
  if (!timingSafeEqual(Buffer.from(sign(c, e, secret), "hex"), Buffer.from(s, "hex"))) return null;
  return codes;
}
