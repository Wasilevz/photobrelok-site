/** Urgency config — edit dates manually after owner confirms them. */
export const URGENCY = {
  timezone: "Europe/Chisinau",
  /** Moldova holidays (gift-giving). Deadline = last day we guarantee the keychain in time. */
  holidays: [
    { name: "Новому году", deadline: "2026-12-28T18:00:00", ro: "Anul Nou" },
    { name: "Рождеству", deadline: "2026-12-22T18:00:00", ro: "Crăciun" },
    { name: "14 февраля", deadline: "2027-02-12T18:00:00", ro: "14 februarie" },
    { name: "8 марта", deadline: "2027-03-06T18:00:00", ro: "8 martie" },
    { name: "Пасхе", deadline: "2027-04-02T18:00:00", ro: "Paște" },
    { name: "1 июня", deadline: "2027-05-29T18:00:00", ro: "1 iunie" },
    { name: "1 сентября", deadline: "2027-08-29T18:00:00", ro: "1 septembrie" },
  ],
  /** before this hour we show mockup the same day (Chisinau time) */
  dailyCutoff: "18:00",
  /** 1–6 = Mon–Sat */
  workdays: [1, 2, 3, 4, 5, 6],
  /** slots for nearest holiday, or null to hide */
  slotsLeft: null as number | null,
};

export type Holiday = (typeof URGENCY.holidays)[number];

function zonedParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) map[p.type] = p.value;
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    y: Number(map.year),
    mo: Number(map.month),
    d: Number(map.day),
    h: Number(map.hour === "24" ? "0" : map.hour),
    mi: Number(map.minute),
    s: Number(map.second),
    wd: weekdayMap[map.weekday] ?? 0,
  };
}

export function chisinauToUtc(localIso: string): Date {
  const [datePart, timePart = "00:00:00"] = localIso.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi, s] = timePart.split(":").map(Number);
  let guess = Date.UTC(y, mo - 1, d, h, mi, s || 0);
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(new Date(guess), URGENCY.timezone);
    const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
    const want = Date.UTC(y, mo - 1, d, h, mi, s || 0);
    const diff = want - asUtc;
    if (diff === 0) break;
    guess += diff;
  }
  return new Date(guess);
}

export function nextHoliday(now: Date = new Date()): Holiday | null {
  const future = URGENCY.holidays
    .map((h) => ({ h, at: chisinauToUtc(h.deadline) }))
    .filter((x) => x.at.getTime() > now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  return future[0]?.h ?? null;
}

export function holidayDeadline(h: Holiday): Date {
  return chisinauToUtc(h.deadline);
}

export function formatDeadline(date: Date, locale: "ru" | "ro"): string {
  const p = zonedParts(date, URGENCY.timezone);
  const monthsRu = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
  const monthsRo = ["ianuarie","februarie","martie","aprilie","mai","iunie","iulie","august","septembrie","octombrie","noiembrie","decembrie"];
  const mm = locale === "ro" ? monthsRo[p.mo - 1] : monthsRu[p.mo - 1];
  return `${p.d} ${mm}, ${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}`;
}

export function splitDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

/**
 * Examples for task A:
 * - 2026-11-01 (33 days to 28.12) → static "Заказы к Новому году — до 28 декабря, 18:00", no timer
 * - 2026-12-20 (8 days) → countdown D дн ЧЧ:ММ:СС
 * - 2026-12-29 → banner hidden (after deadline)
 */
