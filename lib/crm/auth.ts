// Вход в CRM: Telegram Mini App передаёт initData, подписанную токеном бота.
// Проверка по алгоритму Telegram: secret = HMAC_SHA256("WebAppData", botToken),
// hash = hex(HMAC_SHA256(secret, data_check_string)). Плюс свежесть и список разрешённых id.
import { createHmac, timingSafeEqual } from "node:crypto";

export type CrmUser = { id: number; name: string };

type VerifyResult = { ok: true; user: CrmUser } | { ok: false; reason: "bad_signature" | "expired" | "no_user" | "malformed" };

export function verifyInitData(initData: string, botToken: string, nowSec: number, maxAgeSec = 86400): VerifyResult {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const hash = params.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return { ok: false, reason: "malformed" };

  const check = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(check).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, "hex"))) return { ok: false, reason: "bad_signature" };

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || nowSec - authDate > maxAgeSec) return { ok: false, reason: "expired" };

  try {
    const user = JSON.parse(params.get("user") ?? "null") as { id?: unknown; first_name?: unknown; last_name?: unknown } | null;
    if (!user || typeof user.id !== "number") return { ok: false, reason: "no_user" };
    const name = [user.first_name, user.last_name].filter((p) => typeof p === "string" && p).join(" ") || `id ${user.id}`;
    return { ok: true, user: { id: user.id, name } };
  } catch {
    return { ok: false, reason: "no_user" };
  }
}

export function parseAllowed(raw: string | undefined): Set<number> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((id) => Number.isInteger(id) && id > 0),
  );
}

export type AuthEnv = { botToken?: string; allowed?: string; devUserId?: string; nodeEnv?: string };

export function authorize(
  initData: string | null,
  env: AuthEnv,
  nowSec: number,
): { ok: true; user: CrmUser } | { ok: false; status: 401 | 403 } {
  const allowed = parseAllowed(env.allowed);
  let user: CrmUser | null = null;

  if (initData && env.botToken) {
    const result = verifyInitData(initData, env.botToken, nowSec);
    if (result.ok) user = result.user;
  } else if (!initData && env.devUserId && env.nodeEnv !== "production") {
    // Локальная разработка вне Telegram. В production не работает никогда.
    const id = Number(env.devUserId);
    if (Number.isInteger(id)) user = { id, name: "Разработка" };
  }

  if (!user) return { ok: false, status: 401 };
  if (!allowed.has(user.id)) return { ok: false, status: 403 };
  return { ok: true, user };
}
