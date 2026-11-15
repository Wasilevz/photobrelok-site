// Данные заказа в подписи Telegram: чтение, шаблон правки для менеджера и пересборка подписи.
// Подпись — единственное хранилище заказа (базы нет), поэтому всё, что здесь не трогается
// (второй брелок, язык, источник, заметки, история), обязано остаться на месте.

import { chisinauToday, formatDay, isPostMethod, parseManagerDate } from "./delivery-dates.ts";

export type DeliveryMethod = "pickup" | "posta" | "novapost" | "taxi" | "later";

export type DeliveryDetails = {
  postalCode?: string;
  city?: string;
  district?: string;
  street?: string;
  branch?: string;
  address?: string;
};

export type OrderFields = {
  name: string;
  phone: string;
  wantedDate?: string; // YYYY-MM-DD
  urgent: boolean;
  method: DeliveryMethod;
} & DeliveryDetails;

export function cleanText(value: unknown, maxLength = 100): string {
  return typeof value === "string"
    ? value.replace(/[^\p{L}\p{N}\s\-.,/#@+]/gu, "").replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

/* ------------------------------ Блок доставки ------------------------------ */

export function buildDeliveryText(method: DeliveryMethod, d: DeliveryDetails = {}): string {
  switch (method) {
    case "posta":
      // Порядок адреса: улица, район, индекс, город; способ получения идёт последним (см. replaceDelivery)
      return `${d.street ? `🏠 Улица: ${d.street}\n` : ""}🏘 Район: ${d.district}\n📮 Индекс: ${d.postalCode}\n🏙 Город: ${d.city}\n🚚 Способ получения: Poșta Moldovei — 30 лей`;
    case "novapost":
      return `🚚 Способ получения: Nova Poshta — 60 лей\n📦 Отделение №${d.branch}`;
    case "taxi":
      return `🚚 Способ получения: Такси по Кишинёву (оплачивает клиент)\n🏠 Адрес: ${d.address}`;
    case "pickup":
      return "🚚 Способ получения: Самовывоз";
    default:
      return "🚚 Способ получения: клиент уточнит после макета";
  }
}

// Строки блока доставки начинаются с этих эмодзи — по ним блок находится и заменяется.
const DELIVERY_PREFIXES = ["🚚", "📮", "🏘", "🏙", "🏠", "📦", "📍"];
// Строки адреса для почты: стоят сразу под именем клиента, до телефона.
const ADDRESS_PREFIXES = ["🏘", "🏠 Улица:", "🏙", "📮"];
// Хвост подписи: заметки, история, пометка о скрытом поле.
const TAIL_PREFIXES = ["📝", "🕒", "🤖"];

export function methodFromCaption(caption: string): DeliveryMethod {
  const line = caption.split("\n").find((l) => l.startsWith("🚚 Способ получения:")) || "";
  if (line.includes("Самовывоз")) return "pickup";
  if (line.includes("Poșta")) return "posta";
  if (line.includes("Nova Poshta")) return "novapost";
  if (line.includes("Такси")) return "taxi";
  return "later";
}

/**
 * Собирает блок доставки в подписи заказа в таком порядке:
 *   🔥 заказ → 👤 клиент → (почта: улица, район, индекс, город) → 📞 телефон →
 *   🚚 способ получения и его детали (внизу, чтобы бросалось в глаза) → заметки и история.
 */
export function replaceDelivery(caption: string, deliveryBlock: string): string {
  // Строку «📸 Фотографий» больше не показываем: убираем и из старых подписей при правке
  const lines = caption
    .split("\n")
    .filter((l) => !DELIVERY_PREFIXES.some((p) => l.startsWith(p)) && !l.startsWith("📸"));
  const blockLines = deliveryBlock.split("\n");
  const top = blockLines.filter((l) => ADDRESS_PREFIXES.some((p) => l.startsWith(p)));
  const bottom = blockLines.filter((l) => !top.includes(l));

  const clientIdx = lines.findIndex((l) => l.startsWith("👤"));
  lines.splice(clientIdx === -1 ? 1 : clientIdx + 1, 0, ...top);

  const tailIdx = lines.findIndex((l) => TAIL_PREFIXES.some((p) => l.startsWith(p)));
  lines.splice(tailIdx === -1 ? lines.length : tailIdx, 0, ...bottom);
  return lines.join("\n");
}

/* ------------------------------ Чтение подписи ------------------------------ */

function after(lines: string[], prefix: string): string | undefined {
  const line = lines.find((l) => l.startsWith(prefix));
  if (line === undefined) return undefined;
  const value = line.slice(prefix.length).trim();
  return value || undefined;
}

/** Убирает пустые поля, чтобы объекты с одинаковыми данными были равны. */
function compact(f: OrderFields): OrderFields {
  const out = { ...f } as Record<string, unknown>;
  for (const key of Object.keys(out)) {
    if (out[key] === undefined || out[key] === "") delete out[key];
  }
  return out as OrderFields;
}

const DATE_LINE = "📅 Нужен к:";
const SHIP_MARK = " · отправить до:";
const URGENT_LINE = "⚡ СРОЧНО";

export function fieldsFromCaption(caption: string, now: Date): OrderFields {
  const lines = caption.split("\n");
  const method = methodFromCaption(caption);

  let wantedDate: string | undefined;
  const dateText = after(lines, DATE_LINE)?.split(SHIP_MARK)[0];
  const dm = dateText?.match(/(\d{1,2}\.\d{1,2}(?:\.\d{4})?)/);
  if (dm) wantedDate = parseManagerDate(dm[1], now) ?? undefined;

  const f: OrderFields = {
    name: after(lines, "👤 Клиент:") ?? "",
    phone: after(lines, "📞 Тел:") ?? "",
    wantedDate,
    urgent: lines.some((l) => l.startsWith(URGENT_LINE)),
    method,
  };

  if (method === "posta") {
    f.postalCode = after(lines, "📮 Индекс:");
    f.city = after(lines, "🏙 Город:");
    f.district = after(lines, "🏘 Район:");
    f.street = after(lines, "🏠 Улица:");
    // Старый формат: «🏘 Vasileuți, р-н Рышканы»
    const old = lines.find((l) => l.startsWith("🏘 ") && !l.startsWith("🏘 Район:"));
    if (old) {
      const m = old.slice(2).trim().match(/^(.*?),\s*р-н\s*(.*)$/);
      if (m) {
        f.city ??= m[1].trim() || undefined;
        f.district ??= m[2].trim() || undefined;
      } else {
        f.city ??= old.slice(2).trim() || undefined;
      }
    }
  } else if (method === "novapost") {
    f.branch = after(lines, "📦 Отделение №");
  } else if (method === "taxi") {
    f.address = after(lines, "🏠 Адрес:");
  }
  return compact(f);
}

/* ------------------------------ Шаблон правки ------------------------------ */

const METHOD_WORD: Record<DeliveryMethod, string> = {
  pickup: "самовывоз",
  posta: "почта",
  novapost: "nova poshta",
  taxi: "такси",
  later: "уточнит",
};

const METHOD_ALIASES: Record<string, DeliveryMethod> = {
  "самовывоз": "pickup",
  "сам": "pickup",
  "почта": "posta",
  "posta": "posta",
  "poșta": "posta",
  "posta moldovei": "posta",
  "poșta moldovei": "posta",
  "nova poshta": "novapost",
  "новая почта": "novapost",
  "nova": "novapost",
  "такси": "taxi",
  "уточнит": "later",
  "позже": "later",
};

type Key = "name" | "phone" | "wantedDate" | "urgent" | "method" | "postalCode" | "city" | "district" | "street" | "branch" | "address";

const LABELS: Record<string, Key> = {
  "имя": "name",
  "клиент": "name",
  "телефон": "phone",
  "тел": "phone",
  "нужен к": "wantedDate",
  "дата": "wantedDate",
  "срочно": "urgent",
  "способ": "method",
  "доставка": "method",
  "индекс": "postalCode",
  "город": "city",
  "село": "city",
  "район": "district",
  "улица": "street",
  "отделение": "branch",
  "адрес": "address",
};

// Названия полей для истории «✏️ Изменено: …», в порядке шаблона.
const CHANGE_NAMES: [Key, string][] = [
  ["name", "имя"],
  ["phone", "телефон"],
  ["wantedDate", "дата"],
  ["urgent", "срочно"],
  ["method", "способ"],
  ["postalCode", "индекс"],
  ["city", "город"],
  ["district", "район"],
  ["street", "улица"],
  ["branch", "отделение"],
  ["address", "адрес"],
];

function ddmm(day: string): string {
  return `${day.slice(8, 10)}.${day.slice(5, 7)}`;
}

export function fieldsTemplate(f: OrderFields): string {
  const lines = [
    `Имя: ${f.name}`,
    `Телефон: ${f.phone}`,
    `Нужен к: ${f.wantedDate ? ddmm(f.wantedDate) : ""}`,
    `Срочно: ${f.urgent ? "да" : "нет"}`,
    `Способ: ${METHOD_WORD[f.method]}`,
  ];
  if (f.method === "posta") {
    lines.push(`Индекс: ${f.postalCode ?? ""}`, `Город: ${f.city ?? ""}`, `Район: ${f.district ?? ""}`, `Улица: ${f.street ?? ""}`);
  } else if (f.method === "novapost") {
    lines.push(`Отделение: ${f.branch ?? ""}`);
  } else if (f.method === "taxi") {
    lines.push(`Адрес: ${f.address ?? ""}`);
  }
  return lines.join("\n");
}

export type TemplateResult = { ok: true; fields: OrderFields; changed: string[] } | { ok: false; error: string };

const fail = (error: string): TemplateResult => ({ ok: false, error });

export function applyTemplate(text: string, current: OrderFields, now: Date): TemplateResult {
  const next: OrderFields = { ...current };

  for (const raw of text.split("\n")) {
    const colon = raw.indexOf(":");
    if (colon === -1) continue; // строки без «:» (пояснения) пропускаем
    const label = raw.slice(0, colon).trim().toLowerCase().replace(/\s+/g, " ");
    const value = raw.slice(colon + 1).trim();
    if (!label) continue;
    const key = LABELS[label];
    if (!key) {
      return fail(`Не понял строку «${raw.trim().slice(0, 40)}». Поля: имя, телефон, нужен к, срочно, способ, индекс, город, район, улица, отделение, адрес`);
    }

    switch (key) {
      case "name":
        if (value) next.name = cleanText(value, 50);
        break;
      case "phone":
        if (value) next.phone = cleanText(value, 40);
        break;
      case "wantedDate":
        if (!value) next.wantedDate = undefined;
        else {
          const day = parseManagerDate(value, now);
          if (!day) return fail("Дата — в виде ДД.ММ, например 21.11");
          next.wantedDate = day;
        }
        break;
      case "urgent": {
        if (!value) break;
        const v = value.toLowerCase();
        if (["да", "+", "yes", "da"].includes(v)) next.urgent = true;
        else if (["нет", "-", "no", "nu"].includes(v)) next.urgent = false;
        else return fail("Срочно — да или нет");
        break;
      }
      case "method": {
        if (!value) break;
        const method = METHOD_ALIASES[value.toLowerCase().replace(/\s+/g, " ")];
        if (!method) return fail(`Не понял способ: «${value.slice(0, 30)}». Варианты: самовывоз, почта, nova poshta, такси, уточнит`);
        next.method = method;
        break;
      }
      case "street":
        next.street = cleanText(value, 100) || undefined;
        break;
      case "postalCode":
        if (value) next.postalCode = cleanText(value, 20);
        break;
      case "city":
      case "district":
        if (value) next[key] = cleanText(value, 80);
        break;
      case "branch":
        if (value) next.branch = cleanText(value.replace(/^№\s*/, ""), 40);
        break;
      case "address":
        if (value) next.address = cleanText(value, 150);
        break;
    }
  }

  // Поля других способов не храним: при смене способа они бы «всплыли» снова.
  if (next.method !== "posta") {
    next.postalCode = next.city = next.district = next.street = undefined;
  }
  if (next.method !== "novapost") next.branch = undefined;
  if (next.method !== "taxi") next.address = undefined;

  if (next.urgent && isPostMethod(next.method)) return fail("Срочно — только самовывоз или такси");
  if (next.urgent && !next.wantedDate) next.wantedDate = chisinauToday(now);
  if (next.method === "posta" && (!next.postalCode || !next.city || !next.district)) {
    return fail("Для почты нужны: индекс, город, район");
  }
  if (next.method === "novapost" && !next.branch) return fail("Для Nova Poshta нужен номер отделения");
  if (next.method === "taxi" && !next.address) return fail("Для такси нужен адрес");
  if (!next.name) return fail("Имя не может быть пустым");

  const fields = compact(next);
  const before = compact(current);
  const changed = CHANGE_NAMES.filter(([k]) => before[k] !== fields[k]).map(([, n]) => n);
  return { ok: true, fields, changed };
}

/* ---------------------------- Пересборка подписи ---------------------------- */

/**
 * Заменяет строки клиента, телефона, срочности, даты и блок доставки по полям заказа.
 * shipByDay — «отправить до» (только для почты и Nova Poshta).
 */
export function setFieldLines(caption: string, f: OrderFields, shipByDay?: string): string {
  const owned = ["👤", "📞", "📅", URGENT_LINE, "📸", ...DELIVERY_PREFIXES];
  const source = caption.split("\n");
  const clientAt = source.findIndex((l) => l.startsWith("👤"));
  // Сколько «своих» строк стояло до клиента: столько же сдвигается точка вставки после их удаления.
  const ownedBefore = clientAt === -1 ? 0 : source.slice(0, clientAt).filter((l) => owned.some((p) => l.startsWith(p))).length;
  const lines = source.filter((l) => !owned.some((p) => l.startsWith(p)));

  const blockLines = buildDeliveryText(f.method, f).split("\n");
  const top = blockLines.filter((l) => ADDRESS_PREFIXES.some((p) => l.startsWith(p)));
  const bottom = blockLines.filter((l) => !top.includes(l));

  const dateLine = f.wantedDate
    ? `${DATE_LINE} ${formatDay(f.wantedDate, "ru")}${shipByDay && isPostMethod(f.method) ? `${SHIP_MARK} ${formatDay(shipByDay, "ru")}` : ""}`
    : null;

  // Конец заголовка: после блока второго брелка (между линиями «━»), иначе после первой строки.
  const rules = lines.map((l, i) => (l.startsWith("━") ? i : -1)).filter((i) => i !== -1);
  const headerEnd = rules.length >= 2 ? rules[1] + 1 : 1;

  const clientIdx = clientAt === -1 ? headerEnd : Math.max(headerEnd, clientAt - ownedBefore);
  lines.splice(clientIdx, 0, `👤 Клиент: ${f.name}`, ...top, `📞 Тел: ${f.phone}`, ...(dateLine ? [dateLine] : []));

  const tailIdx = lines.findIndex((l) => TAIL_PREFIXES.some((p) => l.startsWith(p)));
  lines.splice(tailIdx === -1 ? lines.length : tailIdx, 0, ...bottom);

  if (f.urgent) {
    lines.splice(headerEnd, 0, `${URGENT_LINE} +100 лей · на сегодня${f.wantedDate ? ` ${ddmm(f.wantedDate)}` : ""}`);
  }
  return lines.join("\n");
}
