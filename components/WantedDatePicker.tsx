"use client";

import React, { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { addDays, earliestDate, formatDay, latestDate, chisinauToday, urgentOpen } from "@/lib/delivery-dates";

export type WantedValue = { date: string; urgent: boolean };

interface Props {
  id: string;
  method: "pickup" | "posta" | "novapost";
  value: WantedValue | null;
  onChange: (value: WantedValue | null) => void;
  error?: string;
}

const pillClass =
  "flex flex-col justify-center px-3 py-2.5 rounded-xl border-2 transition-colors min-h-[48px] cursor-pointer text-sm border-[#D9D0BF] bg-white hover:border-[#191715] has-[:checked]:border-[#191715] has-[:checked]:bg-[#FFC400]/35 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#191715]";

/**
 * «Когда нужен брелок?» — кнопками, календарь только по «Другая дата».
 * Варианты зависят от способа: самовывоз — с завтра (и «сегодня срочно» до 18:00),
 * почта — с ближайшей реальной даты получения. Правила — lib/delivery-dates.ts (их же проверяет сервер).
 */
export default function WantedDatePicker({ id, method, value, onChange, error }: Props) {
  const { dict, lang } = useLanguage();
  const w = dict.orderModal.when;
  // «Сейчас» фиксируем при открытии формы, чтобы варианты не прыгали во время заполнения
  const [now] = useState(() => new Date());
  const [otherOpen, setOtherOpen] = useState(false);

  const isPost = method !== "pickup";
  const first = earliestDate(method, now);
  const quick = [first, addDays(first, 1)];
  const showUrgent = !isPost && urgentOpen(now);
  const today = chisinauToday(now);

  const selected = value?.urgent ? "urgent" : value && quick.includes(value.date) && !otherOpen ? value.date : value || otherOpen ? "other" : "";

  const quickLabel = (day: string, i: number) =>
    isPost ? formatDay(day, lang) : `${i === 0 ? w.tomorrow : w.dayAfter}, ${formatDay(day, lang)}`;

  const errorId = `${id}-err`;

  return (
    <fieldset className="min-w-0 border-0 p-0 m-0" aria-describedby={error ? errorId : undefined}>
      <legend className="block text-[#3D3832] text-sm mb-1 p-0">{isPost ? w.postTitle : w.pickupTitle}</legend>
      {isPost && <p className="text-[#5C564E] text-xs mb-2">{w.postHint}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" id={id} tabIndex={-1}>
        {quick.map((day, i) => (
          <label key={day} className={pillClass}>
            <input
              type="radio"
              name={`${id}-choice`}
              className="sr-only"
              checked={selected === day}
              onChange={() => {
                setOtherOpen(false);
                onChange({ date: day, urgent: false });
              }}
            />
            <span className="font-medium text-[#191715]">{quickLabel(day, i)}</span>
          </label>
        ))}
        <label className={`${pillClass} col-span-2 sm:col-span-1`}>
          <input
            type="radio"
            name={`${id}-choice`}
            className="sr-only"
            checked={selected === "other"}
            onChange={() => {
              setOtherOpen(true);
              if (value && (value.urgent || quick.includes(value.date))) onChange(null);
            }}
          />
          <span className="font-medium text-[#191715]">{w.otherDate}</span>
        </label>

        {showUrgent && (
          <label className={`${pillClass} col-span-2 sm:col-span-3`}>
            <input
              type="radio"
              name={`${id}-choice`}
              className="sr-only"
              checked={selected === "urgent"}
              onChange={() => {
                setOtherOpen(false);
                onChange({ date: today, urgent: true });
              }}
            />
            <span className="font-semibold text-[#191715]">{w.urgent}</span>
            <span className="text-xs text-[#5C564E]">{w.urgentHint}</span>
          </label>
        )}
      </div>

      {selected === "other" && (
        <div className="mt-3">
          <label htmlFor={`${id}-other`} className="block text-[#5C564E] text-sm mb-1">{w.otherDateLabel}</label>
          <input
            id={`${id}-other`}
            type="date"
            autoComplete="off"
            min={first}
            max={latestDate(now)}
            value={value && !value.urgent ? value.date : ""}
            onChange={(e) => {
              const day = e.target.value;
              // Браузер может пропустить дату вне min/max при ручном вводе — проверяем сами
              onChange(day && day >= first && day <= latestDate(now) ? { date: day, urgent: false } : null);
            }}
            className={`w-full bg-white border rounded-lg px-4 py-3 text-base text-[#191715] min-h-[48px] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#191715] ${error ? "border-[#B42318] border-2" : "border-[#D9D0BF]"}`}
          />
        </div>
      )}

      {error && (
        <p id={errorId} role="alert" className="text-[#B42318] text-sm mt-1 flex gap-1.5">
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </p>
      )}
    </fieldset>
  );
}
