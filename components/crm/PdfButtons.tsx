"use client";

import { useState } from "react";
import { ApiError, downloadPdf, sendPdfToMe, webApp } from "./useCrmApi";

/** Главное требование владельца: PDF — «нажал, открыл, сохранил». */
export default function PdfButtons({ code, hasPdf, botUsername }: { code: string; hasPdf: boolean; botUsername?: string }) {
  const [busy, setBusy] = useState<"down" | "send" | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const run = async (kind: "down" | "send") => {
    setBusy(kind);
    setNote(null);
    try {
      if (kind === "down") {
        await downloadPdf(code);
      } else {
        const result = await sendPdfToMe(code);
        if (result === "sent") {
          setNote("PDF отправлен вам в личный чат с ботом");
          webApp()?.HapticFeedback?.notificationOccurred?.("success");
        } else if (result === "start_bot") {
          setNote(`Бот не может написать вам первым: откройте ${botUsername ? `@${botUsername}` : "бота"}, нажмите «Start» и повторите`);
        } else {
          setNote("PDF этого заказа не найден");
        }
      }
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : "Не получилось, попробуйте ещё раз");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        {hasPdf && (
          <button
            type="button"
            onClick={() => run("down")}
            disabled={busy !== null}
            className="min-h-[52px] rounded-xl bg-[#FFC400] border-2 border-[#191715] font-bold text-base active:scale-[0.98] disabled:opacity-60"
          >
            {busy === "down" ? "Готовим…" : "⬇️ Скачать PDF"}
          </button>
        )}
        <button
          type="button"
          onClick={() => run("send")}
          disabled={busy !== null}
          className={`min-h-[52px] rounded-xl bg-white border-2 border-[#191715] font-semibold text-sm active:scale-[0.98] disabled:opacity-60 ${hasPdf ? "" : "col-span-2"}`}
        >
          {busy === "send" ? "Отправляем…" : "📩 Прислать в Telegram"}
        </button>
      </div>
      {note && <p className="text-sm text-[#5C564E]" role="status">{note}</p>}
    </div>
  );
}
