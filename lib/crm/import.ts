// Перенос прошлых заказов из выгрузки чата Telegram (result.json) в CRM.
// Сообщения в чате при этом не меняются. Повторный запуск дублей не создаёт (code уникален).

import { fieldsFromCaption } from "../order-fields.ts";
import { type CrmOrder, type Stage, orderToRow } from "./model.ts";

type ExportText = string | { type?: string; text?: string };
type ExportMessage = {
  id: number;
  type?: string;
  from?: string;
  date_unixtime?: string;
  reply_to_message_id?: number;
  text?: string | ExportText[];
};

export type ImportedOrder = Omit<CrmOrder, "commentsCount" | "boxes" | "extraCost" | "paid"> & {
  comments: { author: string; text: string; at: string }[];
};

function plain(text: ExportMessage["text"]): string {
  if (typeof text === "string") return text;
  return (text ?? []).map((part) => (typeof part === "string" ? part : part.text ?? "")).join("");
}

const BOT = "PHOTOBRELOK";

export function parseExport(json: unknown, topics: { work: number; done: number }): ImportedOrder[] {
  const data = json as { id?: number; messages?: ExportMessage[] };
  const chatId = data.id ? Number(`-100${data.id}`) : null;
  const messages = data.messages ?? [];
  const orders = new Map<string, ImportedOrder>();
  const byMessage = new Map<number, ImportedOrder>();

  for (const m of messages) {
    if (m.type !== "message" || m.from !== BOT) continue;
    const text = plain(m.text);
    const code = text.match(/#([A-Z0-9]{6})/)?.[1];
    if (!code || !text.startsWith("🔥 Новый заказ")) continue;
    const at = new Date(Number(m.date_unixtime) * 1000);
    const f = fieldsFromCaption(text, at);
    const inSupergroup = m.id > 0 && chatId !== null;
    const stage: Stage = m.reply_to_message_id === topics.work ? "production" : "done";
    const lines = text.split("\n");
    const order: ImportedOrder = {
      code,
      createdAt: at.toISOString(),
      stage,
      stageChangedAt: at.toISOString(),
      name: f.name || "Без имени",
      phone: f.phone || "—",
      wantedDate: f.wantedDate ?? null,
      urgent: f.urgent,
      method: f.method,
      postalCode: f.postalCode ?? null,
      city: f.city ?? null,
      district: f.district ?? null,
      street: f.street ?? null,
      branch: f.branch ?? null,
      address: f.address ?? null,
      qty: /2 БРЕЛКА|ВТОРОЙ БРЕЛОК|АПСЕЛЛ/.test(text) ? 2 : 1,
      price: null,
      lang: text.includes("румынском") ? "ro" : "ru",
      source: lines.find((l) => l.startsWith("📣 Источник:"))?.slice("📣 Источник:".length).trim() || null,
      pdfPath: null,
      tgChatId: inSupergroup ? chatId : null,
      tgMessageId: inSupergroup ? m.id : null,
      tgCaption: inSupergroup ? text : null,
      flags: ["imported"],
      comments: lines
        .filter((l) => l.startsWith("📝"))
        .map((l) => ({ author: "Заметка из чата", text: l.slice(2).trim(), at: at.toISOString() })),
    };
    // Заказ мог встречаться дважды (копия при переносе по темам) — берём последнюю версию.
    orders.set(code, order);
    byMessage.set(m.id, order);
  }

  for (const m of messages) {
    if (m.type !== "message") continue;
    const text = plain(m.text);
    if (m.from === BOT) {
      // Отдельное сообщение «АПСЕЛЛ! Заявка #CODE» — второй брелок.
      const code = text.includes("АПСЕЛЛ") ? text.match(/#([A-Z0-9]{6})/)?.[1] : undefined;
      const order = code ? orders.get(code) : undefined;
      if (order) order.qty = Math.max(order.qty, 2);
      continue;
    }
    // Ответы людей на сообщение заказа — комментарии.
    const order = m.reply_to_message_id !== undefined ? byMessage.get(m.reply_to_message_id) : undefined;
    if (order && text.trim()) {
      order.comments.push({ author: m.from ?? "Чат", text: text.trim().slice(0, 1000), at: new Date(Number(m.date_unixtime) * 1000).toISOString() });
    }
  }
  return [...orders.values()];
}

function lit(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return `array[${value.map(lit).join(", ")}]::text[]`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** SQL для Supabase: вставка без перезаписи (on conflict do nothing), комментарии и история — только к новым строкам. */
export function importSql(list: ImportedOrder[]): string {
  return list
    .map((o) => {
      const { comments, ...order } = o;
      const row = orderToRow(order);
      const cols = Object.keys(row);
      const values = cols.map((c) => lit(row[c]));
      const commentRows = comments.map((c) => `(${lit(c.author)}, ${lit(c.text)}, ${lit(c.at)}::timestamptz)`);
      return [
        `with ins as (insert into public.crm_orders (${cols.join(", ")}) values (${values.join(", ")}) on conflict (code) do nothing returning id)`,
        commentRows.length > 0
          ? `, c as (insert into public.crm_comments (order_id, author_name, text, created_at) select ins.id, v.a, v.t, v.at from ins, (values ${commentRows.join(", ")}) as v(a, t, at))`
          : "",
        `insert into public.crm_history (order_id, actor_name, action, details) select id, 'Импорт из чата', 'imported', '{}'::jsonb from ins;`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}
