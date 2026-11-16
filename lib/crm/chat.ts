// Чат производства: заказ лежит в теме своей стадии, под ним — кнопка следующего шага (одно нажатие),
// «Назад» на случай ошибки и ссылка в CRM. Чистые функции — без Telegram и базы.
import { COLUMNS, type Column, type CrmOrder, type Stage, STAGES, columnLabel, columnOf, nextStage, prevStage } from "./model.ts";
import { isPostMethod } from "../delivery-dates.ts";
import { crmAppUrl } from "./links.ts";

export type ChatButton = { text: string; callback_data: string } | { text: string; url: string };
export type StageThreads = Record<Column, number | undefined>;

type O = Pick<CrmOrder, "code" | "stage" | "method">;

function nextLabel(o: O, to: Stage): string {
  if (to === "production") return o.stage === "done" ? "↩️ Вернуть в работу" : "▶️ В производство";
  if (to === "ready") return isPostMethod(o.method) ? "📦 Готов к отправке" : "🏪 Готов к выдаче";
  if (to === "done") return isPostMethod(o.method) ? "🏁 Отправлен — завершить" : "🏁 Выдан — завершить";
  return "↩️ Назад";
}

export function chatKeyboard(o: O, botUsername: string | undefined): ChatButton[][] {
  const rows: ChatButton[][] = [];
  const step = (to: Stage, text: string): ChatButton => ({ text, callback_data: `st:${o.code}:${to}` });
  const next = nextStage(o.stage);
  const prev = prevStage(o.stage);
  if (o.stage === "done") rows.push([step("production", nextLabel(o, "production"))]);
  else {
    const row: ChatButton[] = [];
    if (next) row.push(step(next, nextLabel(o, next)));
    if (prev) row.push(step(prev, "↩️ Назад"));
    rows.push(row);
  }
  const url = crmAppUrl(o.code, botUsername);
  if (url) rows.push([{ text: "📋 Открыть в CRM", url }]);
  return rows;
}

export function parseStageCallback(data: string | undefined): { code: string; stage: Stage } | null {
  const m = /^st:([A-Z0-9]{6}):(\w+)$/.exec(data ?? "");
  if (!m || !STAGES.includes(m[2] as Stage)) return null;
  return { code: m[1], stage: m[2] as Stage };
}

/** Тема для заказа. Пока нет отдельной темы «Новые» — новые лежат в «В работе». */
export function threadFor(o: Pick<CrmOrder, "stage" | "method">, threads: StageThreads): number | undefined {
  const column = columnOf(o);
  return threads[column] ?? (column === "new" ? threads.production : undefined);
}

/** Какие темы переименовать, чтобы их названия совпадали со стадиями CRM (saved — уже выставленные имена). */
export function topicRenames(threads: StageThreads, saved: Record<string, string>): { thread: number; name: string }[] {
  return COLUMNS.flatMap((c) => {
    const thread = threads[c];
    const name = columnLabel(c);
    return thread && saved[thread] !== name ? [{ thread, name }] : [];
  });
}
