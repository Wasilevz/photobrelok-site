// Supabase для CRM: только на сервере (сервисный ключ). Запрет владельца: здесь нет ни одного удаления —
// ни строк, ни файлов. Загрузка PDF без перезаписи (upsert: false).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type Costs, type CrmOrder, ZERO_COSTS, orderToRow, rowToOrder } from "./model.ts";
import type { CrmUser } from "./auth.ts";
import type { ReportRow } from "./reports.ts";
import type { Expense, ExpenseInput } from "./expenses.ts";
import { type PrintSettings, type Sender, parsePrint, parseSender } from "./post-forms/data.ts";

const BUCKET = "order-pdfs";

let client: SupabaseClient | null = null;

export function crmEnabled(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function db(): SupabaseClient {
  if (!crmEnabled()) throw new Error("CRM is not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  client ??= createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

const ORDER_SELECT = "*, crm_comments(count)";

function withCount(row: Record<string, unknown>): Record<string, unknown> {
  const agg = row.crm_comments as { count?: number }[] | undefined;
  return { ...row, comments_count: agg?.[0]?.count ?? 0 };
}

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`CRM ${what}: ${error?.message ?? "unknown error"}`);
}

type NewOrder = Omit<CrmOrder, "commentsCount" | "boxes" | "extraCost" | "paid" | "deletedAt">;

export async function insertOrder(o: NewOrder): Promise<void> {
  const { error } = await db().from("crm_orders").insert(orderToRow(o));
  if (error) fail("insert", error);
}

export async function getOrder(code: string): Promise<CrmOrder | null> {
  const { data, error } = await db().from("crm_orders").select(ORDER_SELECT).eq("code", code).maybeSingle();
  if (error) fail("get", error);
  return data ? rowToOrder(withCount(data)) : null;
}

export async function listOrders(opts: { doneDays: number; q?: string }): Promise<CrmOrder[]> {
  const since = new Date(Date.now() - opts.doneDays * 86400_000).toISOString();
  let query = db()
    .from("crm_orders")
    .select(ORDER_SELECT)
    .is("deleted_at", null)
    .or(`stage.neq.done,stage_changed_at.gte."${since}"`)
    .order("created_at", { ascending: false })
    .limit(500);
  const q = (opts.q ?? "").replace(/[^\p{L}\p{N}\s+]/gu, "").trim().slice(0, 40);
  if (q) query = query.or(`name.ilike."*${q}*",phone.ilike."*${q}*",code.ilike."*${q}*"`); // значения в кавычках: в них бывают точки и пробелы
  const { data, error } = await query;
  if (error) fail("list", error);
  return (data ?? []).map((row) => rowToOrder(withCount(row)));
}

/** Только update — строки заказов никогда не удаляются. */
export async function saveOrder(code: string, row: Record<string, unknown>): Promise<void> {
  const { error } = await db().from("crm_orders").update(row).eq("code", code);
  if (error) fail("update", error);
}

async function orderId(code: string): Promise<string> {
  const { data, error } = await db().from("crm_orders").select("id").eq("code", code).maybeSingle();
  if (error) fail("lookup", error);
  if (!data) throw new Error(`CRM order ${code} not found`);
  return data.id as string;
}

export type HistoryAction = "created" | "imported" | "stage" | "field" | "comment";

export async function addHistory(code: string, actor: CrmUser | null, action: HistoryAction, details: object): Promise<void> {
  const { error } = await db()
    .from("crm_history")
    .insert({ order_id: await orderId(code), actor_id: actor?.id ?? null, actor_name: actor?.name ?? "Сайт", action, details });
  if (error) fail("history", error);
}

export type CrmComment = { authorName: string; text: string; createdAt: string };
export type CrmHistoryItem = { actorName: string; action: HistoryAction; details: Record<string, unknown>; createdAt: string };

export async function addComment(code: string, actor: CrmUser, text: string): Promise<void> {
  const { error } = await db()
    .from("crm_comments")
    .insert({ order_id: await orderId(code), author_id: actor.id, author_name: actor.name, text });
  if (error) fail("comment", error);
}

export async function listComments(code: string): Promise<CrmComment[]> {
  const { data, error } = await db()
    .from("crm_comments")
    .select("author_name, text, created_at")
    .eq("order_id", await orderId(code))
    .order("created_at", { ascending: true });
  if (error) fail("comments", error);
  return (data ?? []).map((r) => ({ authorName: r.author_name, text: r.text, createdAt: r.created_at }));
}

export async function listHistory(code: string): Promise<CrmHistoryItem[]> {
  const { data, error } = await db()
    .from("crm_history")
    .select("actor_name, action, details, created_at")
    .eq("order_id", await orderId(code))
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) fail("history list", error);
  return (data ?? []).map((r) => ({ actorName: r.actor_name, action: r.action, details: r.details ?? {}, createdAt: r.created_at }));
}

/** Кладёт PDF без перезаписи: если имя занято — <code>-2.pdf, <code>-3.pdf… Возвращает путь. */
export async function uploadPdf(code: string, pdf: Buffer): Promise<string> {
  for (let n = 1; n <= 9; n++) {
    const path = n === 1 ? `${code}.pdf` : `${code}-${n}.pdf`;
    const { error } = await db().storage.from(BUCKET).upload(path, pdf, { contentType: "application/pdf", upsert: false });
    if (!error) return path;
    if (!/exists|duplicate|409/i.test(error.message)) fail("pdf upload", error);
  }
  throw new Error(`CRM pdf upload: no free name for ${code}`);
}

/** Ссылка на 10 минут: view — открыть для просмотра, иначе браузер/Telegram сохраняет файл как Brelok_<код>.pdf. */
export async function signedPdfUrl(path: string, code: string, view = false): Promise<string> {
  const { data, error } = await db()
    .storage.from(BUCKET)
    .createSignedUrl(path, 600, view ? undefined : { download: `Brelok_${code}.pdf` });
  if (error || !data) fail("pdf link", error);
  return data.signedUrl;
}

export async function downloadPdf(path: string): Promise<Buffer> {
  const { data, error } = await db().storage.from(BUCKET).download(path);
  if (error || !data) fail("pdf download", error);
  return Buffer.from(await data.arrayBuffer());
}

/**
 * Строки для отчёта: пришедшие за период ИЛИ завершённые за период (с запасом в сутки на часовой пояс —
 * точные границы по Кишинёву считает reports.ts).
 */
export async function reportRows(fromDay: string, toDay: string): Promise<ReportRow[]> {
  const since = new Date(new Date(`${fromDay}T00:00:00Z`).getTime() - 86400_000).toISOString();
  const until = new Date(new Date(`${toDay}T00:00:00Z`).getTime() + 2 * 86400_000).toISOString();
  const rows: ReportRow[] = [];
  for (let page = 0; page < 50; page++) {
    const { data, error } = await db()
      .from("crm_orders")
      .select("code, created_at, stage_changed_at, qty, urgent, price, stage, method, boxes, extra_cost")
      .is("deleted_at", null)
      .or(
        `and(created_at.gte."${since}",created_at.lt."${until}"),and(stage.eq.done,stage_changed_at.gte."${since}",stage_changed_at.lt."${until}")`,
      )
      .order("created_at", { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    if (error) fail("report", error);
    for (const r of data ?? []) {
      rows.push({
        code: r.code, createdAt: r.created_at, stageChangedAt: r.stage_changed_at, qty: r.qty, urgent: r.urgent,
        price: r.price, stage: r.stage, method: r.method, boxes: r.boxes, extraCost: r.extra_cost,
      });
    }
    if ((data ?? []).length < 1000) break;
  }
  return rows;
}

export async function listExpenses(fromDay: string, toDay: string): Promise<Expense[]> {
  const { data, error } = await db()
    .from("crm_expenses")
    .select("id, day, amount, note, created_by")
    .gte("day", fromDay)
    .lte("day", toDay)
    .order("day", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) fail("expenses", error);
  return (data ?? []).map((r) => ({ id: r.id, day: r.day, amount: r.amount, note: r.note, createdBy: r.created_by }));
}

export async function addExpense(e: ExpenseInput, actor: CrmUser): Promise<void> {
  const { error } = await db().from("crm_expenses").insert({ ...e, created_by: actor.name, updated_by: actor.name });
  if (error) fail("expense add", error);
}

/** Расходы не удаляются: ошибочный ставят в 0. */
export async function updateExpense(id: string, patch: Partial<ExpenseInput>, actor: CrmUser): Promise<boolean> {
  const { data, error } = await db()
    .from("crm_expenses")
    .update({ ...patch, updated_by: actor.name, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) fail("expense update", error);
  return (data ?? []).length > 0;
}

/** Себестоимость единиц (лей). Пока не задана — нули. */
export async function getCosts(): Promise<Costs> {
  const { data, error } = await db().from("crm_settings").select("value").eq("key", "costs").maybeSingle();
  if (error) fail("settings", error);
  return parseCosts(data?.value) ?? ZERO_COSTS;
}

export async function saveCosts(costs: Costs, actor: CrmUser): Promise<void> {
  const { error } = await db()
    .from("crm_settings")
    .upsert({ key: "costs", value: costs, updated_at: new Date().toISOString(), updated_by: actor.name });
  if (error) fail("settings save", error);
}

export function parseCosts(value: unknown): Costs | null {
  const v = value as Record<string, unknown> | null;
  if (!v || typeof v !== "object") return null;
  const out = {} as Costs;
  for (const k of ["keychain", "box"] as const) {
    const n = v[k] ?? 0;
    if (!Number.isFinite(n) || (n as number) < 0 || (n as number) > 100000) return null;
    out[k] = Math.round((n as number) * 100) / 100;
  }
  return out;
}

/** Отправитель для почтовых бланков; null — ещё не заполнен. */
export async function getSender(): Promise<Sender | null> {
  const { data, error } = await db().from("crm_settings").select("value").eq("key", "sender").maybeSingle();
  if (error) fail("sender", error);
  if (!data) return null;
  const parsed = parseSender(data.value);
  return parsed.ok ? parsed.value : null;
}

export async function saveSender(sender: Sender, actor: CrmUser): Promise<void> {
  const { error } = await db()
    .from("crm_settings")
    .upsert({ key: "sender", value: sender, updated_at: new Date().toISOString(), updated_by: actor.name });
  if (error) fail("sender save", error);
}

/** Размеры бланков и сдвиг печати (мм). */
export async function getPrint(): Promise<PrintSettings> {
  const { data, error } = await db().from("crm_settings").select("value").eq("key", "print").maybeSingle();
  if (error) fail("print", error);
  return parsePrint(data?.value);
}

export async function savePrint(print: PrintSettings, actor: CrmUser): Promise<void> {
  const { error } = await db()
    .from("crm_settings")
    .upsert({ key: "print", value: print, updated_at: new Date().toISOString(), updated_by: actor.name });
  if (error) fail("print save", error);
}

/**
 * Полное удаление одного заказа (кнопка «Удалить заказ» с подтверждением; решение владельца):
 * PDF из хранилища, комментарии, история и сама строка. Больше нигде в коде удалений нет (см. lib/no-deletes.test.ts).
 */
export async function purgeOrder(code: string): Promise<{ pdfRemoved: boolean }> {
  const { data: row, error } = await db().from("crm_orders").select("id, pdf_path").eq("code", code).maybeSingle();
  if (error) fail("purge lookup", error);
  if (!row) return { pdfRemoved: false };
  let pdfRemoved = false;
  if (row.pdf_path) {
    const { error: e } = await db().storage.from(BUCKET).remove([row.pdf_path as string]);
    if (e) fail("purge pdf", e);
    pdfRemoved = true;
  }
  for (const table of ["crm_comments", "crm_history"]) {
    const { error: e } = await db().from(table).delete().eq("order_id", row.id);
    if (e) fail(`purge ${table}`, e);
  }
  const { error: e } = await db().from("crm_orders").delete().eq("id", row.id);
  if (e) fail("purge order", e);
  return { pdfRemoved };
}
