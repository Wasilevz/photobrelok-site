// Даты получения заказа. Всё считается по времени Кишинёва: сервер Vercel работает в UTC.
// Даты — строки YYYY-MM-DD; арифметика идёт по UTC-полуночи этих строк, поэтому
// переход на летнее/зимнее время дни не сдвигает.
// Модуль без локальных импортов: его используют форма, API и тесты (node --test).

export type DateMethod = "pickup" | "taxi" | "posta" | "novapost" | "later";

const TZ = "Europe/Chisinau";
const URGENT_CLOSE_MINUTES = 18 * 60; // срочно «на сегодня» — до 18:00
const MAX_DAYS_AHEAD = 90;
const POST_WORKDAYS = 2; // изготовить и отправить
const POST_TRANSIT_DAYS = 3; // почта в пути

function parts(now: Date): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)) {
    out[p.type] = p.value;
  }
  return out;
}

export function chisinauToday(now: Date): string {
  const p = parts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Минуты с полуночи по Кишинёву. */
export function chisinauMinutes(now: Date): number {
  const p = parts(now);
  return Number(p.hour) * 60 + Number(p.minute);
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function toUtc(day: string): Date {
  const [, y, m, d] = DAY_RE.exec(day) as RegExpExecArray;
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Строка — настоящая календарная дата YYYY-MM-DD (не 31.02). */
export function isDay(value: unknown): value is string {
  if (typeof value !== "string" || !DAY_RE.test(value)) return false;
  return fromUtc(toUtc(value)) === value;
}

export function addDays(day: string, n: number): string {
  const d = toUtc(day);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

/** +n рабочих дней (пн–пт), начиная со следующего дня. */
export function addWorkdays(day: string, n: number): string {
  let current = day;
  let left = n;
  while (left > 0) {
    current = addDays(current, 1);
    const wd = toUtc(current).getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return current;
}

export function isPostMethod(method: DateMethod): boolean {
  return method === "posta" || method === "novapost";
}

/** Ближайшая обычная (не срочная) дата получения для способа. */
export function earliestDate(method: DateMethod, now: Date): string {
  const today = chisinauToday(now);
  if (isPostMethod(method)) return addDays(addWorkdays(today, POST_WORKDAYS), POST_TRANSIT_DAYS);
  return addDays(today, 1);
}

/** До какой даты отправить посылку, если заказ сделан сейчас. */
export function shipBy(now: Date): string {
  return addWorkdays(chisinauToday(now), POST_WORKDAYS);
}

export function latestDate(now: Date): string {
  return addDays(chisinauToday(now), MAX_DAYS_AHEAD);
}

/** Можно ли ещё заказать срочно на сегодня. graceMinutes — запас для сервера. */
export function urgentOpen(now: Date, graceMinutes = 0): boolean {
  return chisinauMinutes(now) < URGENT_CLOSE_MINUTES + graceMinutes;
}

export type WantedProblem = "format" | "too_early" | "too_far" | "urgent_post" | "urgent_late" | "urgent_date";

export function validateWanted(o: {
  method: DateMethod;
  wantedDate: string;
  urgent: boolean;
  now: Date;
  graceMinutes?: number;
}): WantedProblem | null {
  if (!isDay(o.wantedDate)) return "format";
  const today = chisinauToday(o.now);
  if (o.urgent) {
    if (isPostMethod(o.method)) return "urgent_post";
    if (o.wantedDate !== today) return "urgent_date";
    if (!urgentOpen(o.now, o.graceMinutes ?? 0)) return "urgent_late";
    return null;
  }
  if (o.wantedDate < earliestDate(o.method, o.now)) return "too_early";
  if (o.wantedDate > latestDate(o.now)) return "too_far";
  return null;
}

const WEEKDAYS = {
  ru: ["вс", "пн", "вт", "ср", "чт", "пт", "сб"],
  ro: ["dum", "lun", "mar", "mie", "joi", "vin", "sâm"],
} as const;

/** «пт 21.11» / «vin 21.11». */
export function formatDay(day: string, lang: "ru" | "ro"): string {
  const d = toUtc(day);
  return `${WEEKDAYS[lang][d.getUTCDay()]} ${day.slice(8, 10)}.${day.slice(5, 7)}`;
}

/** Дата от менеджера: «21.11», «21/11», «21.11.2026». Без года — ближайшая дата не раньше сегодня. */
export function parseManagerDate(input: string, now: Date): string | null {
  const m = /^\s*(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2}|\d{4}))?\s*$/.exec(input);
  if (!m) return null;
  const pad = (n: string) => n.padStart(2, "0");
  const build = (year: number) => `${year}-${pad(m[2])}-${pad(m[1])}`;
  if (m[3]) {
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const day = build(year);
    return isDay(day) ? day : null;
  }
  const today = chisinauToday(now);
  const year = Number(today.slice(0, 4));
  const thisYear = build(year);
  if (isDay(thisYear) && thisYear >= today) return thisYear;
  const nextYear = build(year + 1);
  return isDay(nextYear) ? nextYear : null;
}

export type OrderDate = { ok: true; urgent: boolean; wantedDate?: string } | { ok: false; problem: WantedProblem | "taxi_not_urgent" };

/**
 * Дата из тела заказа. Без даты и без срочности заказ принимается: так отправляет форма,
 * открытая до обновления сайта, — иначе клиент получил бы ошибку о поле, которого не видит.
 */
export function readOrderDate(o: { method: DateMethod; wantedDate: unknown; urgent: unknown; now: Date; graceMinutes?: number }): OrderDate {
  const urgent = o.urgent === true;
  if (o.method === "taxi" && !urgent) return { ok: false, problem: "taxi_not_urgent" };
  if (o.wantedDate === undefined && !urgent) return { ok: true, urgent };
  const wantedDate = typeof o.wantedDate === "string" ? o.wantedDate : "";
  const problem = validateWanted({ method: o.method, wantedDate, urgent, now: o.now, graceMinutes: o.graceMinutes });
  return problem ? { ok: false, problem } : { ok: true, urgent, wantedDate };
}
