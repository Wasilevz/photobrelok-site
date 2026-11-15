"use client";

// Доска: телефон — вкладки колонок со счётчиками; компьютер (≥1024px) — 5 колонок и перетаскивание.
import { useState } from "react";
import { type Column, type CrmOrder, COLUMNS, columnLabel, columnOf, sortOrders } from "@/lib/crm/model";
import { METHOD_LABEL, dateLabel } from "./format";
import { PostFormsButton } from "./PostForms";

function OrderListItem({
  order,
  onOpen,
  onDownload,
  draggable,
}: {
  order: CrmOrder;
  onOpen: () => void;
  onDownload: () => void;
  draggable?: boolean;
}) {
  return (
    <li
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", order.code);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`relative rounded-xl border bg-white ${order.urgent ? "border-[#B42318] border-2" : "border-[#E5DCCB]"} ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <button type="button" onClick={onOpen} className="block w-full px-3 py-2.5 pr-14 text-left">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xs text-[#5C564E]">#{order.code}</span>
          {order.urgent && <span className="text-xs font-bold text-[#B42318]">⚡ СРОЧНО</span>}
          {order.paid && <span className="rounded bg-[#ECFDF3] px-1.5 text-xs font-bold text-[#067647]">💳 ОПЛАЧЕН</span>}
        </div>
        <div className="truncate font-semibold">{order.name}</div>
        <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-[#3D3832]">
          <span>📅 {dateLabel(order.wantedDate)}</span>
          <span>{METHOD_LABEL[order.method]}</span>
          {order.qty > 1 && <span className="font-semibold">🔑 {order.qty} шт.</span>}
          {order.commentsCount > 0 && <span>💬 {order.commentsCount}</span>}
        </div>
      </button>
      {order.pdfPath && (
        <button
          type="button"
          onClick={onDownload}
          aria-label={`Скачать PDF заказа ${order.code}`}
          className="absolute right-1.5 top-1.5 flex size-11 items-center justify-center rounded-lg bg-[#FFC400]/50 text-lg hover:bg-[#FFC400]"
        >
          ⬇️
        </button>
      )}
    </li>
  );
}

export default function Board({
  orders,
  onOpen,
  onDownload,
  onDrop,
  onMoreDone,
  notify,
}: {
  orders: CrmOrder[];
  onOpen: (code: string) => void;
  onDownload: (code: string) => void;
  onDrop: (code: string, column: Column) => void;
  onMoreDone: () => void;
  notify: (text: string) => void;
}) {
  const [tab, setTab] = useState<Column>("new");
  const [over, setOver] = useState<Column | null>(null);
  const byColumn = Object.fromEntries(COLUMNS.map((c) => [c, sortOrders(orders.filter((o) => columnOf(o) === c))])) as Record<Column, CrmOrder[]>;

  const postCodes = byColumn.ship.filter((o) => o.method === "posta").map((o) => o.code);

  const list = (c: Column, draggable: boolean) => (
    <>
      {c === "ship" && postCodes.length > 0 && (
        <div className="mb-2">
          <PostFormsButton
            codes={postCodes}
            notify={notify}
            label={`🖨 Бланки Poșta для всех (${postCodes.length})`}
            className="min-h-[44px] w-full rounded-xl border-2 border-[#191715] bg-[#FFC400] text-sm font-semibold disabled:opacity-60"
          />
        </div>
      )}
      {byColumn[c].length === 0 && <p className="px-1 py-6 text-center text-sm text-[#5C564E]">Пусто</p>}
      <ul className="flex flex-col gap-2">
        {byColumn[c].map((o) => (
          <OrderListItem key={o.code} order={o} draggable={draggable} onOpen={() => onOpen(o.code)} onDownload={() => onDownload(o.code)} />
        ))}
      </ul>
      {c === "done" && (
        <button type="button" onClick={onMoreDone} className="mt-2 min-h-[44px] w-full rounded-xl border border-[#D9D0BF] bg-white text-sm">
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
              aria-selected={tab === c}
              onClick={() => setTab(c)}
              className={`shrink-0 min-h-[40px] rounded-full border-2 px-3 text-sm font-medium ${
                tab === c ? "border-[#191715] bg-[#FFC400]" : "border-[#D9D0BF] bg-white"
              }`}
            >
              {columnLabel(c)} <span className="ml-0.5 tabular-nums opacity-70">{byColumn[c].length}</span>
            </button>
          ))}
        </div>
        <div className="pt-2">{list(tab, false)}</div>
      </div>

      {/* Компьютер: колонки рядом */}
      <div className="hidden lg:grid lg:grid-cols-5 lg:gap-3">
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
