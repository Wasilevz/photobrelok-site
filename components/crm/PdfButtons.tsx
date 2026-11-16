"use client";

import { useState } from "react";
import { ApiError, downloadPdf, openTelegram } from "./useCrmApi";

/** Главное требование владельца: PDF — «нажал, открыл, сохранил». */
/** PDF в хранилище CRM — скачать сразу; заказ, перенесённый из чата, — открыть его сообщение, PDF там. */
export default function PdfButtons({ code, hasPdf, chatUrl }: { code: string; hasPdf: boolean; chatUrl?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (!hasPdf) {
    if (!chatUrl) return null;
    return (
      <div className="mb-4">
        <button
          type="button"
          onClick={() => openTelegram(chatUrl)}
          className="min-h-[52px] w-full rounded-xl bg-[#FFC400] border-2 border-[#191715] font-bold text-base active:scale-[0.98]"
        >
          📄 PDF в чате — открыть сообщение
        </button>
        <p className="mt-1 text-xs text-[#5C564E]">Заказ перенесён из чата: PDF лежит в его сообщении — нажмите на файл и сохраните.</p>
      </div>
    );
  }

  const run = async () => {
    setBusy(true);
    setNote(null);
    try {
      await downloadPdf(code);
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : "Не получилось, попробуйте ещё раз");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 flex flex-col gap-2">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="min-h-[52px] rounded-xl bg-[#FFC400] border-2 border-[#191715] font-bold text-base active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? "Готовим…" : "⬇️ Скачать PDF"}
      </button>
      {note && <p className="text-sm text-[#5C564E]" role="status">{note}</p>}
    </div>
  );
}
