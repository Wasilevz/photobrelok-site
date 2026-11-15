// Данные для почтовых бланков Poșta Moldovei: что и как вписать. Чистые функции — без PDF и базы.
import { type CrmOrder, orderPrice } from "../model.ts";

const UNITS = ["zero", "unu", "doi", "trei", "patru", "cinci", "șase", "șapte", "opt", "nouă"];
const TEENS = [
  "zece", "unsprezece", "doisprezece", "treisprezece", "paisprezece",
  "cincisprezece", "șaisprezece", "șaptesprezece", "optsprezece", "nouăsprezece",
];
const TENS = ["", "", "douăzeci", "treizeci", "patruzeci", "cincizeci", "șaizeci", "șaptezeci", "optzeci", "nouăzeci"];

function below100(n: number): string {
  if (n < 10) return UNITS[n];
  if (n < 20) return TEENS[n - 10];
  const t = TENS[Math.floor(n / 10)];
  return n % 10 ? `${t} și ${UNITS[n % 10]}` : t;
}

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const hundreds = h === 0 ? "" : h === 1 ? "o sută" : `${h === 2 ? "două" : UNITS[h]} sute`;
  return [hundreds, rest || !hundreds ? below100(rest) : ""].filter(Boolean).join(" ");
}

/** Число прописью по-румынски (целые 0…999 999). */
export function numberWordsRo(n: number): string {
  const th = Math.floor(n / 1000);
  const rest = n % 1000;
  if (th === 0) return below1000(rest);
  let thousands: string;
  if (th === 1) thousands = "o mie";
  else {
    // «mie» — женский род: două/douăsprezece mii; от 20 — «de mii».
    const w = below1000(th).replace(/\bdoi$/, "două").replace(/^doisprezece$/, "douăsprezece");
    thousands = th % 100 >= 20 || th % 100 === 0 ? `${w} de mii` : `${w} mii`;
  }
  return rest ? `${thousands} ${below1000(rest)}` : thousands;
}

/** Как в образце почты: «Cinci sute lei, zero bani». */
export function amountWordsRo(lei: number): string {
  const w = numberWordsRo(lei);
  return `${w[0].toUpperCase()}${w.slice(1)} lei, zero bani`;
}

/** «+373 68 866 772» → «068 866 772» — так телефоны пишут на бланках. */
export function localPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("373") && digits.length === 11 ? digits.slice(3) : digits.startsWith("0") && digits.length === 9 ? digits.slice(1) : null;
  if (!local) return phone;
  return `0${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
}

export type ParcelType = "scrisoare" | "pachet" | "colet";
export type Sender = {
  name: string;
  street: string;
  locality: string;
  phone: string;
  /** Куда почта переводит деньги наложенного платежа: на адрес (наличными) или на карту (IDNP + IBAN). */
  payout: "address" | "card";
  idnp: string;
  iban: string;
  parcelType: ParcelType;
  /** Объявленная ценность = сумме наложенного платежа (как в образце почты). */
  declareValue: boolean;
};

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const line = (v: unknown, max = 70) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

export function parseSender(body: unknown): Result<Sender> {
  const b = (body ?? {}) as Record<string, unknown>;
  const s: Sender = {
    name: line(b.name),
    street: line(b.street),
    locality: line(b.locality),
    phone: line(b.phone, 30),
    payout: b.payout === "card" ? "card" : "address",
    idnp: line(b.idnp, 20).replace(/\D/g, ""),
    iban: line(b.iban, 40).replace(/\s/g, "").toUpperCase(),
    parcelType: b.parcelType === "scrisoare" || b.parcelType === "colet" ? b.parcelType : "pachet",
    declareValue: b.declareValue !== false,
  };
  if (!s.name || !s.street || !s.locality || !s.phone) return { ok: false, error: "Заполните имя, улицу, индекс с городом и телефон отправителя" };
  if (s.payout === "card") {
    if (!/^\d{13}$/.test(s.idnp)) return { ok: false, error: "IDNP — 13 цифр" };
    if (!/^MD\d{2}[A-Z0-9]{18,30}$/.test(s.iban)) return { ok: false, error: "Проверьте IBAN (начинается с MD)" };
  }
  return { ok: true, value: s };
}

export type FormOrder = Pick<
  CrmOrder,
  "code" | "name" | "phone" | "method" | "postalCode" | "city" | "district" | "street" | "qty" | "urgent" | "price" | "paid"
>;

export type FormData = {
  code: string;
  cod: boolean;
  amount: number;
  amountDigits: string;
  amountCents: string;
  amountWords: string;
  declaredDigits: string;
  declaredWords: string;
  recipient: { name: string; street: string; locality: string; phone: string };
};

/** Неоплаченный — наложенный платёж на сумму заказа; оплаченный — обычное отправление без сумм. */
export function formData(o: FormOrder, sender: Sender): FormData {
  const cod = !o.paid;
  const amount = orderPrice(o);
  const city = (o.city ?? "").toUpperCase();
  const district = o.district && o.district.toLowerCase() !== (o.city ?? "").toLowerCase() ? `r-nul ${o.district}` : "";
  const declared = cod && sender.declareValue;
  return {
    code: o.code,
    cod,
    amount,
    amountDigits: cod ? String(amount) : "",
    amountCents: cod ? `${amount},00` : "",
    amountWords: cod ? amountWordsRo(amount) : "",
    declaredDigits: declared ? String(amount) : "",
    declaredWords: declared ? numberWordsRo(amount) : "",
    recipient: {
      name: o.name,
      street: o.street ?? "",
      locality: [o.postalCode, city, district].filter(Boolean).join(", "),
      phone: localPhone(o.phone),
    },
  };
}

/** Печать на готовые бланки почты: размер листа-бланка и сдвиг текста (мм) — у каждого принтера свой. */
export type BlankKind = "ramburs" | "tfp3";
export type BlankPrint = { w: number; h: number; dx: number; dy: number };
export type PrintSettings = Record<BlankKind, BlankPrint>;

/** Размеры рамки бланков в официальных файлах почты (замерено по PDF). */
export const DEFAULT_PRINT: PrintSettings = {
  ramburs: { w: 200.4, h: 101.6, dx: 0, dy: 0 },
  tfp3: { w: 200.2, h: 98.8, dx: 0, dy: 0 },
};

export function parsePrint(value: unknown): PrintSettings {
  const v = (value ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const num = (x: unknown, min: number, max: number, def: number) => {
    const n = typeof x === "string" ? Number(x.replace(",", ".")) : x;
    return typeof n === "number" && Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 10) / 10 : def;
  };
  const one = (k: BlankKind): BlankPrint => {
    const d = DEFAULT_PRINT[k];
    const s = v[k] ?? {};
    const size = { w: num(s.w, 50, 300, NaN), h: num(s.h, 30, 300, NaN) };
    const sizeOk = Number.isFinite(size.w) && Number.isFinite(size.h);
    return { w: sizeOk ? size.w : d.w, h: sizeOk ? size.h : d.h, dx: num(s.dx, -30, 30, 0), dy: num(s.dy, -30, 30, 0) };
  };
  return { ramburs: one("ramburs"), tfp3: one("tfp3") };
}
