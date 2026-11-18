// Утренняя сводка в чат производства: что просрочено, что выдать и отправить сегодня, что на завтра,
// по каким посылкам давно ждём деньги. Чистая функция — без сети, её проверяют тесты.
import { addDays, chisinauToday, formatDay, isPostMethod } from "../delivery-dates.ts";
import { type CrmOrder, columnLabel, columnOf, moneyState, sortOrders } from "./model.ts";

const MAX_LINES = 15; // на раздел; остальное — «…и ещё N»
const MONEY_WAIT_DAYS = 10;

const day = (d: string) => formatDay(d, "ru");

/** Крайний день по заказу: почта — отправить за 3 дня до получения, остальное — выдать в день получения. */
function deadline(o: CrmOrder): string | null {
  if (!o.wantedDate) return null;
  return isPostMethod(o.method) ? addDays(o.wantedDate, -3) : o.wantedDate;
}

function line(o: CrmOrder, extra: string[] = []): string {
  const parts = [
    ...extra,
    ...(o.qty > 1 ? [`${o.qty} шт.`] : []),
    ...(o.urgent ? ["⚡ срочно"] : []),
    ...(o.paid ? ["💳 оплачен"] : []),
    columnLabel(columnOf(o)),
  ];
  return `• #${o.code} ${o.name} · ${parts.join(" · ")}`;
}

function section(title: string, orders: CrmOrder[], toLine: (o: CrmOrder) => string): string[] {
  if (orders.length === 0) return [];
  const shown = sortOrders(orders).slice(0, MAX_LINES).map(toLine);
  const more = orders.length - shown.length;
  return ["", `${title} — ${orders.length}:`, ...shown, ...(more > 0 ? [`…и ещё ${more}`] : [])];
}

export function morningSummary(orders: CrmOrder[], now: Date): string {
  const today = chisinauToday(now);
  const tomorrow = addDays(today, 1);
  const open = orders.filter((o) => o.stage !== "done" && !o.deletedAt);
  const receive = (o: CrmOrder) => (isPostMethod(o.method) && o.wantedDate ? [`получить ${day(o.wantedDate)}`] : []);

  const overdue = open.filter((o) => (deadline(o) ?? today) < today);
  const giveToday = open.filter((o) => !isPostMethod(o.method) && o.wantedDate === today);
  const shipToday = open.filter((o) => isPostMethod(o.method) && deadline(o) === today);
  const soon = open.filter((o) => deadline(o) === tomorrow);
  const waitSince = addDays(today, -MONEY_WAIT_DAYS);
  const money = orders.filter(
    (o) => o.stage === "done" && !o.deletedAt && isPostMethod(o.method) && moneyState(o) === "pending" && chisinauToday(new Date(o.stageChangedAt)) <= waitSince,
  );

  const body = [
    ...section("🔴 Просрочено", overdue, (o) => {
      const d = deadline(o) as string;
      return line(o, [isPostMethod(o.method) ? `📦 отправить ${day(d)}` : `🏪 выдать ${day(d)}`]);
    }),
    ...section("🏪 Выдать сегодня", giveToday, (o) => line(o)),
    ...section("📦 Отправить сегодня", shipToday, (o) => line(o, receive(o))),
    ...section("📅 Завтра", soon, (o) => line(o, receive(o))),
    ...section(`💰 Ждём деньги с почты больше ${MONEY_WAIT_DAYS} дней`, money, (o) => `• #${o.code} ${o.name} · отправлен ${day(chisinauToday(new Date(o.stageChangedAt)))}${o.track ? ` · трек ${o.track}` : ""}`),
  ];
  const header = `☀️ Доброе утро! Заказы на ${day(today)}`;
  return body.length > 0 ? [header, ...body].join("\n") : `${header}\n\nНа сегодня и завтра сроков нет 👍`;
}
