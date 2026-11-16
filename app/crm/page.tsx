"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { type Column, type CrmOrder, columnLabel, columnOf, stageOfColumn } from "@/lib/crm/model";
import Board from "@/components/crm/Board";
import OrderSheet from "@/components/crm/OrderSheet";
import Reports from "@/components/crm/Reports";
import { ApiError, downloadPdf, openTelegram, patchOrder, useOrders, webApp } from "@/components/crm/useCrmApi";
import { chatMessageUrl } from "@/components/crm/format";

export default function CrmPage() {
  const [tgReady, setTgReady] = useState(false);
  const [tgLoaded, setTgLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [doneDays, setDoneDays] = useState(30);
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Страница запустилась — аварийная плашка из app/legacy-script.ts больше не нужна.
  useEffect(() => {
    (window as Window & { __crmMounted?: boolean }).__crmMounted = true;
    const banner = document.getElementById("crm-fatal");
    if (banner) banner.style.display = "none";
  }, []);

  // Вне Telegram (локальная разработка) скрипт Telegram может не загрузиться — не ждём его дольше 2 секунд.
  useEffect(() => {
    const t = setTimeout(() => setTgReady(true), 2000);
    return () => clearTimeout(t);
  }, []);

  const onTelegramLoaded = () => {
    const tg = webApp();
    tg?.ready?.();
    tg?.expand?.();
    const start = tg?.initDataUnsafe?.start_param;
    if (start && /^[A-Z0-9]{6}$/.test(start)) setOpenCode(start);
    setTgReady(true);
    setTgLoaded(true);
  };

  const { orders, setOrders, error, reload } = useOrders(query, doneDays, tgReady);

  // Скрипт Telegram догрузился после первого запроса (медленный компьютер) — запрашиваем заново, уже со входом.
  useEffect(() => {
    if (tgLoaded) void reload();
  }, [tgLoaded, reload]);

  const notify = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const upsert = useCallback(
    (order: CrmOrder) => setOrders((list) => (list ? list.map((o) => (o.code === order.code ? order : o)) : list)),
    [setOrders],
  );

  const download = async (code: string) => {
    const order = orders?.find((o) => o.code === code);
    const chatUrl = order && !order.pdfPath ? chatMessageUrl(order) : null;
    if (chatUrl) return openTelegram(chatUrl); // перенесён из чата — PDF в сообщении
    try {
      await downloadPdf(code);
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Не удалось скачать PDF");
    }
  };

  const drop = async (code: string, column: Column) => {
    try {
      const { order } = await patchOrder(code, { stage: stageOfColumn(column) });
      upsert(order);
      if (columnOf(order) !== column) notify(`Способ получения — ${order.method === "pickup" || order.method === "taxi" ? "выдача" : "почта"}, заказ в «${columnLabel(columnOf(order))}»`);
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Не получилось перенести заказ");
      void reload();
    }
  };

  const denied = error && (error.status === 401 || error.status === 403);

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" onLoad={onTelegramLoaded} />

      <header className="sticky top-0 z-20 border-b border-[#E5DCCB] bg-[#F5F1E8]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-2.5">
          <div className="shrink-0 font-bold">PHOTOBRELOK <span className="font-normal text-[#5C564E]">CRM</span></div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск: имя, телефон, код"
            aria-label="Поиск заказов"
            autoComplete="off"
            className="min-h-[40px] w-full min-w-0 rounded-full border border-[#D9D0BF] bg-white px-4 text-sm"
          />
          {!denied && (
            <button
              type="button"
              onClick={() => setReportsOpen(true)}
              aria-label="Отчёты"
              className="flex min-h-[40px] shrink-0 items-center gap-1 rounded-full border border-[#D9D0BF] bg-white px-3 text-sm font-medium"
            >
              📊<span className="hidden sm:inline">Отчёты</span>
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 pb-10">
        {denied && (
          <div className="mx-auto mt-10 max-w-md rounded-2xl bg-white p-5 text-center">
            <p className="text-lg font-semibold">{error.message}</p>
            {error.status === 401 && (
              <p className="mt-2 text-sm text-[#5C564E]">
                CRM работает только внутри Telegram: откройте @photobrelok_bot и нажмите кнопку CRM. Если на компьютере ссылка открылась в браузере —
                обновите Telegram Desktop до последней версии (или откройте web.telegram.org).
              </p>
            )}
            {error.status === 403 && (
              <p className="mt-2 text-sm text-[#5C564E]">Попросите владельца добавить ваш Telegram id. Узнать его: напишите боту команду /id.</p>
            )}
          </div>
        )}
        {error && !denied && (
          <div className="mt-3 rounded-xl bg-white p-3 text-sm text-[#B42318]">
            {error.message} <button type="button" className="underline" onClick={() => void reload()}>Повторить</button>
          </div>
        )}
        {!orders && !error && <p className="py-10 text-center text-[#5C564E]">Загружаем заказы…</p>}
        {orders && (
          <Board
            orders={orders}
            onOpen={setOpenCode}
            onDownload={download}
            onDrop={drop}
            onMoreDone={() => setDoneDays((d) => d + 60)}
            notify={notify}
          />
        )}
      </main>

      {openCode && (
        <OrderSheet
          code={openCode}
          onClose={() => setOpenCode(null)}
          onChanged={upsert}
          onDeleted={(code) => {
            setOpenCode(null);
            setOrders((list) => (list ? list.filter((o) => o.code !== code) : list));
            notify(`Заказ #${code} удалён`);
          }}
          notify={notify}
        />
      )}

      {reportsOpen && <Reports onClose={() => setReportsOpen(false)} />}

      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-24 z-[60] mx-auto max-w-md rounded-xl bg-[#191715] px-4 py-3 text-center text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
