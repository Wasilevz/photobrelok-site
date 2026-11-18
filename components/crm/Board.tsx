"use client";

// Доска: телефон — вкладки колонок со счётчиками; компьютер (≥1024px) — 5 колонок и перетаскивание.
// Под каждым заказом — кнопка следующего шага (та же, что в чате производства): карточку открывать не нужно.
import { useState } from "react";
import { type Column, type CrmOrder, COLUMNS, amountDue, columnLabel, columnOf, moneyState, sortOrders } from "@/lib/crm/model";
import { isPostMethod } from "@/lib/delivery-dates";
import { type QuickAction, quickAction } from "@/lib/crm/chat";
import { chisinauToday } from "@/lib/delivery-dates";
import { METHOD_LABEL, chatMessageUrl, dateLabel } from "./format";
import { PostFormsButtons } from "./PostForms";
import { badge, btnPlain, btnPrimary, card } from "./ui";

function OrderListItem({
  order,
  today,
  onOpen,
  onDownload,
  onAction,
  draggable,
}: {
  order: CrmOrder;
  today: string;
  onOpen: () => void;
  onDownload: () => void;
  onAction: (action: QuickAction) => void;
  draggable?: boolean;
}) {
  const money = moneyState(order);
  const action = quickAction(order);
  const hasPdf = !!order.pdfPath || !!chatMessageUrl(order);
  const late = order.stage !== "done" && !!order.wantedDate && order.wantedDate < today;
  const isToday = order.stage !== "done" && order.wantedDate === today;
  // Трек-код нужен, как только посылка готова к отправке: по нему узнаём заказ из SMS почты.
  const needTrack = isPostMethod(order.method) && (order.stage === "ready" || money === "pending");
  return (
    <li
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", order.code);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`${card} overflow-hidden ${order.urgent ? "ring-2 ring-[#B42318]" : ""} ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <button type="button" onClick={onOpen} className="block w-full px-3 pb-2 pt-2.5 text-left">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-semibold">{order.name}</span>
          <span className="shrink-0 text-sm font-semibold tabular-nums">{amountDue(order)} лей</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[#5C564E]">
          <span className="font-mono">#{order.code}</span>
          <span className={late ? "font-bold text-[#B42318]" : isToday ? "font-bold text-[#191715]" : ""}>
            📅 {dateLabel(order.wantedDate)}
            {late ? " · просрочен" : isToday ? " · сегодня" : ""}
          </span>
          <span>{METHOD_LABEL[order.method]}</span>
        </div>
        {needTrack && (
          <div className={`mt-1 text-xs ${order.track ? "font-mono font-semibold text-[#191715]" : "text-[#B54708]"}`}>
            🔎 {order.track ?? "трек-код не указан"}
          </div>
        )}
        {(order.urgent || order.paid || money === "pending" || money === "returned" || order.qty > 1 || order.commentsCount > 0) && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {order.urgent && <span className={`${badge} bg-[#B42318] text-white`}>⚡ СРОЧНО</span>}
            {order.paid && <span className={`${badge} bg-[#ECFDF3] text-[#067647]`}>💳 ОПЛАЧЕН</span>}
            {money === "pending" && <span className={`${badge} bg-[#FFFAEB] text-[#B54708]`}>⏳ ждём деньги</span>}
            {money === "returned" && <span className={`${badge} bg-[#FEF3F2] text-[#B42318]`}>↩️ возврат</span>}
            {order.qty > 1 && <span className={`${badge} bg-[#F5F1E8] text-[#191715]`}>🔑 {order.qty} шт.</span>}
            {order.commentsCount > 0 && <span className={`${badge} bg-[#F5F1E8] text-[#191715]`}>💬 {order.commentsCount}</span>}
          </div>
        )}
      </button>
      {(action || hasPdf) && (
        <div className="flex gap-2 border-t border-[#F0EADD] px-2 py-2">
          {hasPdf && (
            <button type="button" onClick={onDownload} aria-label={`Скачать PDF заказа ${order.code}`} title="Скачать PDF" className={`${btnPlain} shrink-0`}>
              ⬇️<span className="lg:hidden"> PDF</span>
            </button>
          )}
          {action && (
            <button type="button" onClick={() => onAction(action)} className={`${btnPrimary} min-w-0 flex-1 py-1 leading-tight lg:px-2 lg:text-[13px]`}>
              {action.label}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export default function Board({
  orders,
  onOpen,
  onDownload,
  onAction,
  onDrop,
  onMoreDone,
  notify,
  searching,
}: {
  orders: CrmOrder[];
  /** Идёт поиск: на телефоне сразу показываем вкладку, где нашёлся заказ. */
  searching?: boolean;
  onOpen: (code: string) => void;
  onDownload: (code: string) => void;
  onAction: (order: CrmOrder, action: QuickAction) => void;
  onDrop: (code: string, column: Column) => void;
  onMoreDone: () => void;
  notify: (text: string) => void;
}) {
  const [tab, setTab] = useState<Column>("new");
  const [over, setOver] = useState<Column | null>(null);
  const today = chisinauToday(new Date());
  const byColumn = Object.fromEntries(COLUMNS.map((c) => [c, sortOrders(orders.filter((o) => columnOf(o) === c))])) as Record<Column, CrmOrder[]>;

  const postOrders = byColumn.ship.filter((o) => o.method === "posta");
  const postCodes = postOrders.map((o) => o.code);
  const codCodes = postOrders.filter((o) => !o.paid).map((o) => o.code);

  // Поиск: если в открытой вкладке ничего не нашлось — показываем первую, где нашлось.
  const shown = (searching && byColumn[tab].length === 0 ? COLUMNS.find((c) => byColumn[c].length > 0) : undefined) ?? tab;

  const list = (c: Column, draggable: boolean) => (
    <>
      {c === "ship" && postCodes.length > 0 && (
        <div className="mb-2">
          <PostFormsButtons codes={postCodes} codCodes={codCodes} notify={notify} countInLabel primary />
        </div>
      )}
      {byColumn[c].length === 0 && <p className="px-1 py-8 text-center text-sm text-[#8A8275]">Здесь пока пусто</p>}
      <ul className="flex flex-col gap-2">
        {byColumn[c].map((o) => (
          <OrderListItem
            key={o.code}
            order={o}
            today={today}
            draggable={draggable}
            onOpen={() => onOpen(o.code)}
            onDownload={() => onDownload(o.code)}
            onAction={(action) => onAction(o, action)}
          />
        ))}
      </ul>
      {c === "done" && (
        <button type="button" onClick={onMoreDone} className={`${btnPlain} mt-2 w-full`}>
          Показать более старые
        </button>
      )}
    </>
  );

  return (
    <>
      {/* Телефон: вкладки */}
      <div className="lg:hidden">
        <div className="sticky top-[60px] z-10 -mx-4 flex gap-1.5 overflow-x-auto bg-[#F5F1E8] px-4 py-2" role="tablist">
          {COLUMNS.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={shown === c}
              onClick={() => setTab(c)}
              className={`min-h-[40px] shrink-0 rounded-full border-2 px-3 text-sm font-medium ${
                shown === c ? "border-[#191715] bg-[#FFC400]" : "border-transparent bg-white"
              }`}
            >
              {columnLabel(c)} <span className="ml-0.5 tabular-nums opacity-70">{byColumn[c].length}</span>
            </button>
          ))}
        </div>
        <div className="pt-2">{list(shown, false)}</div>
      </div>

      {/* Компьютер: колонки рядом */}
      <div className="hidden pt-3 lg:grid lg:grid-cols-5 lg:gap-3">
        {COLUMNS.map((c) => (
          <section
            key={c}
            aria-label={columnLabel(c)}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(c);
            }}
            onDragLeave={() => setOver((cur) => (cur === c ? null : cur))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const code = e.dataTransfer.getData("text/plain");
              const order = orders.find((o) => o.code === code);
              if (order && columnOf(order) !== c) onDrop(code, c);
            }}
            className={`min-h-[60vh] rounded-2xl p-2 transition-colors ${over === c ? "bg-[#FFC400]/25 outline-2 outline-dashed outline-[#191715]" : "bg-[#EDE6D6]"}`}
          >
            <h2 className="mb-2 flex items-center justify-between px-1 text-sm font-semibold">
              {columnLabel(c)} <span className="tabular-nums text-[#5C564E]">{byColumn[c].length}</span>
            </h2>
            {list(c, true)}
          </section>
        ))}
      </div>
    </>
  );
}
