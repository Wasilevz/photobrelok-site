// Расходы бизнеса (реклама, материалы оптом и т. п.) — вычитаются из чистой прибыли периода.
import { isDay } from "../delivery-dates.ts";

export type Expense = { id: string; day: string; amount: number; note: string; createdBy: string | null };
export type ExpenseInput = { day: string; amount: number; note: string };

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** partial — правка: можно прислать только часть полей (но хотя бы одно). */
export function parseExpense(body: unknown, partial: true): Result<Partial<ExpenseInput>>;
export function parseExpense(body: unknown, partial?: false): Result<ExpenseInput>;
export function parseExpense(body: unknown, partial = false): Result<Partial<ExpenseInput>> {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return { ok: false, error: "Некорректные данные" };
  const out: Partial<ExpenseInput> = {};
  if ("day" in b || !partial) {
    if (!isDay(b.day)) return { ok: false, error: "Неверная дата" };
    out.day = b.day;
  }
  if ("amount" in b || !partial) {
    const n = b.amount;
    if (!Number.isInteger(n) || (n as number) < 0 || (n as number) > 10_000_000) return { ok: false, error: "Сумма — целое число лей" };
    out.amount = n as number;
  }
  if ("note" in b || !partial) {
    out.note = typeof b.note === "string" ? b.note.replace(/\s+/g, " ").trim().slice(0, 200) : "";
  }
  if (Object.keys(out).length === 0) return { ok: false, error: "Нечего менять" };
  return { ok: true, value: out };
}
