// Общие части API CRM: вход по Telegram initData и ответы.
import { NextResponse } from "next/server";
import { type CrmUser, authorize } from "./auth.ts";

export const CODE_RE = /^[A-Z0-9]{6}$/;

/** Пользователь CRM или готовый ответ 401/403. Заголовок X-Telegram-Init-Data = Telegram.WebApp.initData. */
export function requireUser(req: Request): CrmUser | NextResponse {
  const result = authorize(
    req.headers.get("x-telegram-init-data"),
    {
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      allowed: process.env.CRM_ALLOWED_USER_IDS,
      devUserId: process.env.CRM_DEV_USER_ID,
      nodeEnv: process.env.NODE_ENV,
    },
    Math.floor(Date.now() / 1000),
  );
  if (result.ok) return result.user;
  return NextResponse.json(
    { error: result.status === 401 ? "Откройте CRM через Telegram" : "Нет доступа к CRM" },
    { status: result.status, headers: { "Cache-Control": "no-store" } },
  );
}

export function ok(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function bad(error: string, status = 400): NextResponse {
  return ok({ error }, status);
}

export async function readJson(req: Request, maxBytes = 16 * 1024): Promise<Record<string, unknown> | null> {
  if (Number(req.headers.get("content-length") || 0) > maxBytes) return null;
  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Сбой базы/сети — 500 без подробностей наружу, подробности в лог. */
export function crash(where: string, error: unknown): NextResponse {
  console.error(`CRM ${where}:`, error);
  return bad("Не удалось выполнить. Попробуйте ещё раз", 500);
}
