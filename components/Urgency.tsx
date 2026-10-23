"use client";

import { useEffect, useState } from "react";
import {
  URGENCY,
  chisinauToUtc,
  formatDeadline,
  holidayDeadline,
  isBeforeCutoff,
  isWorkday,
  nextHoliday,
  nextMockupLabel,
  splitDuration,
} from "@/lib/urgency";
import { useLanguage } from "@/context/LanguageContext";

function useNow(tickMs = 1000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), tickMs);
    const seed = window.setTimeout(() => setNow(new Date()), 0);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(seed);
    };
  }, [tickMs]);
  return now;
}

/** A — banner: static text if >14 days; countdown if ≤14; hide after deadline */
export function UrgencyBanner() {
  const { lang } = useLanguage();
  const now = useNow(1000);
  const holiday = now ? nextHoliday(now) : null;
  if (!holiday || !now) return null;

  const deadline = holidayDeadline(holiday);
  const ms = deadline.getTime() - now.getTime();
  if (ms <= 0) return null;

  const daysLeft = ms / 86400000;
  const name = lang === "ro" ? holiday.ro : holiday.name;
  const dateStr = formatDeadline(deadline, lang);

  // Keep the hero focused: show deadline messaging only when it is genuinely near.
  if (daysLeft > 14) return null;

  const { d, h, m, s } = splitDuration(ms);
  return (
    <div className="urgency-banner" role="status">
      <div className="wrap urgency-banner-inner">
        <span className="urgency-text">
          {lang === "ru"
            ? `Успеть к ${name}: заказы принимаем до ${dateStr}.`
            : `Prinde ${name}: primim comenzi până pe ${dateStr}.`}
        </span>{" "}
        <span className="urgency-count" aria-live="off">
          {lang === "ru" ? "Осталось" : "Au rămas"}{" "}
          <strong className="tnum">{d}</strong>{" "}
          <span className="urgency-unit">{lang === "ru" ? "дн" : "z"}</span>{" "}
          <strong className="tnum">
            {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
          </strong>
        </span>
      </div>
    </div>
  );
}

/** B — under hero CTA */
export function DailyCutoff() {
  const { lang } = useLanguage();
  const now = useNow(1000);
  const cutoff = URGENCY.dailyCutoff;

  if (!now) {
    return (
      <p className="urgency-daily">
        {lang === "ru"
          ? `Макет бесплатно — ${nextMockupLabel("ru")} · Брелок — 1–2 дня · Оплата при получении`
          : `Machetă gratuită — ${nextMockupLabel("ro")} · Breloc — 1–2 zile · Plată la livrare`}
      </p>
    );
  }

  if (!isWorkday(now) || !isBeforeCutoff(now)) {
    const when = nextMockupLabel(lang, now);
    return (
      <p className="urgency-daily">
        {lang === "ru"
          ? `Пришлите фото сейчас — макет покажем ${when}.`
          : `Trimite pozele acum — îți arătăm macheta ${when}.`}
      </p>
    );
  }

  const msToCutoff = (() => {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: URGENCY.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const ymd = fmt.format(now);
    return chisinauToUtc(`${ymd}T${cutoff}:00`).getTime() - now.getTime();
  })();
  const { h, m, s } = splitDuration(msToCutoff);
  return (
    <p className="urgency-daily">
      {lang === "ru"
        ? `Пришлите фото до ${cutoff} — макет покажем сегодня. Осталось `
        : `Trimite pozele până la ${cutoff} — macheta e gata astăzi. Au rămas `}
      <span className="tnum">
        {h}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </span>
    </p>
  );
}

/** C — optional slots */
export function SlotsLeft() {
  const { lang } = useLanguage();
  const n = URGENCY.slotsLeft;
  const holiday = nextHoliday();
  if (n == null || !holiday) return null;
  const name = lang === "ro" ? holiday.ro : holiday.name;
  const dateStr = formatDeadline(holidayDeadline(holiday), lang);
  if (n <= 0) {
    return (
      <p className="urgency-slots" role="status">
        {lang === "ru"
          ? `Места к празднику закончились. Успеем после ${dateStr}`
          : `Locurile pentru sărbătoare s-au terminat. Reușim după ${dateStr}`}
      </p>
    );
  }
  return (
    <div className="urgency-slots-wrap" role="status">
      <div className="urgency-slots-bar" aria-hidden="true">
        <span style={{ width: `${Math.min(100, Math.max(8, n * 12))}%` }} />
      </div>
      <p className="urgency-slots">
        {lang === "ru" ? `Осталось ${n} мест к ${name}` : `Au rămas ${n} locuri pentru ${name}`}
      </p>
    </div>
  );
}
