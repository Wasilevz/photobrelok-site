// Supabase для CRM: только на сервере (сервисный ключ). Запрет владельца: здесь нет ни одного удаления —
// ни строк, ни файлов. Загрузка PDF без перезаписи (upsert: false).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type CrmOrder, orderToRow, rowToOrder } from "./model.ts";
import type { CrmUser } from "./auth.ts";

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

export async function insertOrder(o: Omit<CrmOrder, "commentsCount">): Promise<void> {
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
    .or(`stage.neq.done,stage_changed_at.gte.${since}`)
    .order("created_at", { ascending: false })
    .limit(500);
  const q = (opts.q ?? "").replace(/[^\p{L}\p{N}\s+]/gu, "").trim().slice(0, 40);
  if (q) query = query.or(`name.ilike.*${q}*,phone.ilike.*${q}*,code.ilike.*${q}*`);
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

/** Ссылка на 10 минут, браузер/Telegram сохраняет файл как Brelok_<код>.pdf. */
export async function signedPdfUrl(path: string, code: string): Promise<string> {
  const { data, error } = await db().storage.from(BUCKET).createSignedUrl(path, 600, { download: `Brelok_${code}.pdf` });
  if (error || !data) fail("pdf link", error);
  return data.signedUrl;
}

export async function downloadPdf(path: string): Promise<Buffer> {
  const { data, error } = await db().storage.from(BUCKET).download(path);
  if (error || !data) fail("pdf download", error);
  return Buffer.from(await data.arrayBuffer());
}
