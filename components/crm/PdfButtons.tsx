"use client";

import { useState } from "react";
import { ApiError, downloadPdf } from "./useCrmApi";

/** Главное требование владельца: PDF — «нажал, открыл, сохранил». */
export default function PdfButtons({ code, hasPdf }: { code: string; hasPdf: boolean }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (!hasPdf) return null;

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
