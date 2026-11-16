// Подпись сообщения заказа в чате — зеркало данных CRM. Сообщение не удаляется и не переносится,
// бот только правит подпись: поля, стадию, количество брелков. Всё прочее (второй брелок, язык,
// источник, заметки, история) остаётся на месте.

import { setFieldLines } from "../order-fields.ts";
import { hasUpsell, withoutUpsell } from "../telegram-orders.ts";
import { addDays, isPostMethod } from "../delivery-dates.ts";
import { type CrmOrder, moneyState, stageLabel, toFields } from "./model.ts";

const LIMIT = 1000; // у Telegram лимит подписи 1024
const STAGE_PREFIX = "📌 Стадия:";
const QTY_PREFIX = "🔑 Брелков:";
const PAID_PREFIX = "💳 ОПЛАЧЕН";
const NOT_SAVED = "⚠️ Не записан в CRM";
const MONEY_LINES = ["⏳ Ждём деньги с почты", "💰 Деньги получены", "↩️ Посылку не забрали — возврат"];
const SOURCE_PREFIX = "📣 Источник:"; // источник перехода в чате не показываем (владелец: лишняя информация)

export function buildCrmCaption(o: CrmOrder): string {
  const raw = o.tgCaption ?? `🔥 Новый заказ #${o.code}`;
  // Один брелок — блок «второй брелок» убираем, чтобы подпись не противоречила CRM.
  const base = o.qty === 1 && hasUpsell(raw) ? withoutUpsell(raw) : raw;
  const showQty = o.qty >= 3 || (o.qty === 2 && !hasUpsell(base));
  const shipBy = o.wantedDate && isPostMethod(o.method) ? addDays(o.wantedDate, -3) : undefined;
  const lines = setFieldLines(base, toFields(o), shipBy)
    .split("\n")
    .filter((l) => !l.startsWith(STAGE_PREFIX) && !l.startsWith(QTY_PREFIX) && !l.startsWith(PAID_PREFIX) && !l.startsWith(NOT_SAVED) && !l.startsWith(SOURCE_PREFIX) && !MONEY_LINES.some((m) => l.startsWith(m)));

  // Сразу под заголовком (или под блоком второго брелка) — стадия и количество.
  const rules = lines.map((l, i) => (l.startsWith("━") ? i : -1)).filter((i) => i !== -1);
  const headerEnd = rules.length >= 2 ? rules[1] + 1 : 1;
  const paid = o.paid
    ? [`${PAID_PREFIX} на карту — ${isPostMethod(o.method) ? "наложенный платёж НЕ оформлять" : "деньги с клиента НЕ брать"}`]
    : [];
  const stage = o.deletedAt ? "🗑 Удалён из CRM" : stageLabel(o.stage, o.method);
  const state = moneyState(o);
  const money = state === "pending" ? [MONEY_LINES[0]] : state === "returned" ? [MONEY_LINES[2]] : state === "received" && o.stage === "done" && !o.paid ? [MONEY_LINES[1]] : [];
  const top = [`${STAGE_PREFIX} ${stage}`, ...paid, ...money, ...(showQty ? [`${QTY_PREFIX} ${o.qty}`] : [])];
  lines.splice(headerEnd, 0, ...top);

  // Не влезает — выкидываем самые старые строки истории, потом режем хвост.
  while (lines.join("\n").length > LIMIT) {
    const idx = lines.findIndex((l) => l.startsWith("🕒"));
    if (idx === -1) break;
    lines.splice(idx, 1);
  }
  return lines.join("\n").slice(0, LIMIT);
}
