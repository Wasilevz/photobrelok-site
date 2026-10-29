"use client";

import { useEffect, useState } from "react";
import {
  formatDeadline,
  holidayDeadline,
  nextHoliday,
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
