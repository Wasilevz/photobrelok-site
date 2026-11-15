# Желаемая дата, срочные заказы, простая форма и правка заказа в Telegram — план

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** клиент указывает желаемую дату (и срочность) в упрощённой форме без автозаполнения, а менеджер меняет любые данные заказа через шаблон в Telegram.

**Architecture:** вся логика дат, телефона и полей заказа — в чистых модулях `lib/*.ts` без локальных импортов (тестируются `node --test` напрямую). Форма и API используют одни и те же функции дат. Бот строит шаблон из подписи заказа и пересобирает подпись из исправленного шаблона, сохраняя всё прочее.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind 4, Telegram Bot API, Node 22 (`node --test`, нативное снятие типов).

**Spec:** `docs/superpowers/specs/2026-11-15-order-date-and-editing-design.md`

## Global Constraints

- Все «сегодня/завтра/рабочие дни» — по `Europe/Chisinau`; сервер Vercel работает в UTC.
- Самовывоз: ближайшая обычная дата — завтра; любой день недели. Часы самовывоза 12:00–21:00.
- Срочно: только `pickup` или `taxi`, дата = сегодня, +100 лей. В форме скрыто с 18:00; сервер принимает до 18:30.
- Почта (`posta`, `novapost`): ближайшая дата получения = сегодня + 2 рабочих дня (пн–пт) + 3 календарных дня; «отправить до» = сегодня + 2 рабочих дня. Срочно нельзя.
- Дата не позже чем через 90 дней от сегодня.
- Такси в форме — только при срочном заказе; оплачивает клиент водителю.
- Телефон: только Молдова, `+373` + 8 цифр.
- Новые модули `lib/delivery-dates.ts`, `lib/phone.ts`, `lib/order-fields.ts`, `lib/md-districts.ts` — без импортов кроме `node:*`; тесты импортируют их с расширением `.ts`.
- Без новых npm-зависимостей. Тексты формы RU и RO; тексты бота RU.
- Подпись Telegram ≤ 1024 символа (существующий `appendLine` / `CAPTION_LIMIT`).

## Review Focus

1. Заказ в 23:30 по Кишинёву (21:30 UTC) — «сегодня» уже следующий день для Кишинёва ≠ UTC; ожидается кишинёвская дата. → тест в Task 1.
2. Переход на летнее/зимнее время (29.03.2026, 25.10.2026) — «завтра» не должно съезжать на день. → тест в Task 1.
3. Менеджер пишет поля по-своему: строчные буквы, «Тел» вместо «Телефон», лишние пробелы, удалённые строки, поля в другом порядке. → тест в Task 3.
4. Правка заказа с блоком второго брелка, заметками, историей и языковой пометкой — всё сохраняется, порядок блоков не ломается. → тест в Task 3.
5. Клиент выбрал «Сегодня», потом переключил на почту — срочность и дата сбрасываются, такси исчезает. → проверка в Task 6 (ручная, в браузере).

---

### Task 1: Расчёт дат (`lib/delivery-dates.ts`)

**Files:**
- Create: `lib/delivery-dates.ts`
- Test: `lib/delivery-dates.test.ts`
- Modify: `package.json` (скрипт `"test": "node --test \"lib/**/*.test.ts\""`)

**Interfaces:**
- Produces (даты — строки `YYYY-MM-DD`; арифметика на UTC-полуночи этих строк, не на миллисекундах «сейчас»):
  - `type DateMethod = "pickup" | "taxi" | "posta" | "novapost" | "later"`
  - `chisinauToday(now: Date): string`
  - `chisinauMinutes(now: Date): number` — минуты с полуночи по Кишинёву
  - `addDays(day: string, n: number): string`, `addWorkdays(day: string, n: number): string`
  - `earliestDate(method: DateMethod, now: Date): string` — pickup/taxi/later: завтра; posta/novapost: `addDays(addWorkdays(today, 2), 3)`
  - `shipBy(now: Date): string` — `addWorkdays(today, 2)`
  - `urgentOpen(now: Date, graceMinutes = 0): boolean` — `chisinauMinutes < 18*60 + grace`
  - `validateWanted(o: { method: DateMethod; wantedDate: string; urgent: boolean; now: Date; graceMinutes?: number }): null | "format" | "too_early" | "too_far" | "urgent_post" | "urgent_late" | "urgent_date"`
  - `formatDay(day: string, lang: "ru" | "ro"): string` — `"пт 21.11"` / `"vin 21.11"`
  - `parseManagerDate(input: string, now: Date): string | null` — `"21.11"`, `"21.11.2026"`, `"21/11"`; без года — ближайшая дата ≥ сегодня

- [ ] **Step 1: Write the failing tests** (`node:test`, `assert/strict`, импорт `./delivery-dates.ts`):

```ts
const at = (iso: string) => new Date(iso); // UTC
test("chisinau today differs from UTC late evening", () =>
  assert.equal(chisinauToday(at("2026-11-15T22:30:00Z")), "2026-11-16")); // 00:30 Кишинёв
test("pickup earliest is tomorrow", () =>
  assert.equal(earliestDate("pickup", at("2026-11-15T10:00:00Z")), "2026-11-16"));
test("post: Monday order -> receive from Saturday", () =>
  assert.equal(earliestDate("posta", at("2026-11-16T10:00:00Z")), "2026-11-21"));
test("post: Friday order -> receive from next Friday", () =>
  assert.equal(earliestDate("novapost", at("2026-11-20T10:00:00Z")), "2026-11-27"));
test("post: Saturday order counts workdays from Monday", () =>
  assert.equal(shipBy(at("2026-11-21T10:00:00Z")), "2026-11-24"));
test("DST change does not shift tomorrow", () => {
  assert.equal(earliestDate("pickup", at("2026-03-28T22:30:00Z")), "2026-03-30"); // 00:30 29.03 по Кишинёву
  assert.equal(addDays("2026-10-24", 1), "2026-10-25");
});
test("urgent closes at 18:00, server grace until 18:30", () => {
  const t = at("2026-11-15T16:10:00Z"); // 18:10 Кишинёв (UTC+2)
  assert.equal(urgentOpen(t), false);
  assert.equal(urgentOpen(t, 30), true);
});
test("validateWanted", () => {
  const now = at("2026-11-15T10:00:00Z");
  assert.equal(validateWanted({ method: "pickup", wantedDate: "2026-11-15", urgent: true, now }), null);
  assert.equal(validateWanted({ method: "pickup", wantedDate: "2026-11-15", urgent: false, now }), "too_early");
  assert.equal(validateWanted({ method: "posta", wantedDate: "2026-11-15", urgent: true, now }), "urgent_post");
  assert.equal(validateWanted({ method: "posta", wantedDate: "2026-11-19", urgent: false, now }), "too_early");
  assert.equal(validateWanted({ method: "pickup", wantedDate: "2026-11-17", urgent: true, now }), "urgent_date");
  assert.equal(validateWanted({ method: "pickup", wantedDate: "2027-03-01", urgent: false, now }), "too_far");
  assert.equal(validateWanted({ method: "pickup", wantedDate: "16.11", urgent: false, now }), "format");
});
test("parseManagerDate picks nearest future year", () => {
  const now = at("2026-12-28T10:00:00Z");
  assert.equal(parseManagerDate("03.01", now), "2027-01-03");
  assert.equal(parseManagerDate("30.12", now), "2026-12-30");
  assert.equal(parseManagerDate("31.02", now), null);
});
test("formatDay", () => {
  assert.equal(formatDay("2026-11-21", "ru"), "сб 21.11");
  assert.equal(formatDay("2026-11-21", "ro"), "sâm 21.11");
});
```

- [ ] **Step 2: Run to verify fail** — `npm test` → FAIL (module not found).
- [ ] **Step 3: Implement** — `Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Chisinau", ... })` для сегодня и минут; дни недели — свои массивы `["вс","пн","вт","ср","чт","пт","сб"]` и `["dum","lun","mar","mie","joi","vin","sâm"]`. `too_far` — позже `today + 90`.
- [ ] **Step 4: Run** — `npm test` → все PASS.
- [ ] **Step 5: Commit** — `git commit -m "Даты получения: расчёт по Кишинёву, почта, срочность"`

### Task 2: Телефон и районы (`lib/phone.ts`, `lib/md-districts.ts`)

**Files:**
- Create: `lib/phone.ts`, `lib/md-districts.ts`
- Test: `lib/phone.test.ts`

**Interfaces:**
- Produces:
  - `normalizeMdPhone(input: string): { ok: true; digits: string } | { ok: false; reason: "empty" | "short" | "long" | "foreign"; count: number }` — `digits` = 8 цифр после 373; принимает `69708505`, `069708505`, `+37369708505`, `373 69 708 505`, `0 79 748035`; другой код страны → `foreign`.
  - `formatMdPhone(digits: string): string` → `"+373 69 708 505"`
  - `MD_DISTRICTS: readonly { ro: string; ru: string }[]` — 32 района + `Chișinău/Кишинёв`, `Bălți/Бельцы`, `UTA Găgăuzia/АТО Гагаузия`, `Tiraspol/Тирасполь`, `Bender/Бендеры`, `Stînga Nistrului/Левобережье`; по алфавиту `ro`.

- [ ] **Step 1: Write the failing tests**

```ts
test("normalizes local formats", () => {
  for (const s of ["69708505", "069708505", "+37369708505", "373 69 708 505", "0 79 748035"])
    assert.equal(normalizeMdPhone(s).ok, true, s);
  assert.deepEqual(normalizeMdPhone("069708505"), { ok: true, digits: "69708505" });
});
test("reports digit count problems", () => {
  assert.deepEqual(normalizeMdPhone("6970850"), { ok: false, reason: "short", count: 7 });
  assert.equal((normalizeMdPhone("697085051") as { reason: string }).reason, "long");
  assert.equal((normalizeMdPhone("+40712345678") as { reason: string }).reason, "foreign");
  assert.equal((normalizeMdPhone("  ") as { reason: string }).reason, "empty");
});
test("formats", () => assert.equal(formatMdPhone("69708505"), "+373 69 708 505"));
```

- [ ] **Step 2: Run** — `npm test` → FAIL.
- [ ] **Step 3: Implement** both files.
- [ ] **Step 4: Run** — `npm test` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Телефон Молдовы и список районов"`

### Task 3: Поля заказа в подписи и шаблон правки (`lib/order-fields.ts`)

**Files:**
- Create: `lib/order-fields.ts`
- Test: `lib/order-fields.test.ts`
- Modify: `lib/telegram-orders.ts` — перенести `DeliveryMethod`, `DeliveryDetails`, `buildDeliveryText`, `replaceDelivery`, `methodFromCaption` и их константы в `order-fields.ts`, в `telegram-orders.ts` оставить `export { … } from "./order-fields"`; `buildOrderCaption` получает `urgent?: boolean`, `wantedDate?: string`, `shipBy?: string` и ставит строки через `setFieldLines`.

**Interfaces:**
- Consumes: ничего (модуль без импортов; форматирование даты в подписи — локальная функция, тот же вид `"пт 21.11"`, что `formatDay` из Task 1).
- Produces:
  - `type OrderFields = { name: string; phone: string; wantedDate?: string /* YYYY-MM-DD */; urgent: boolean; method: DeliveryMethod; postalCode?: string; city?: string; district?: string; street?: string; branch?: string; address?: string }`
  - `fieldsFromCaption(caption: string, now: Date): OrderFields` — читает `👤 Клиент:`, `📞 Тел:`, `📅 Нужен к:`, `⚡ СРОЧНО`, блок доставки (новый и старый формат `🏘 Город, р-н Район`, `📦 Отделение №N`, `🏠 Адрес:`).
  - `fieldsTemplate(f: OrderFields): string` — строки `Имя:`, `Телефон:`, `Нужен к: ДД.ММ`, `Срочно: да|нет`, `Способ: самовывоз|почта|nova poshta|такси|уточнит`, затем `Индекс/Город/Район/Улица` (почта), `Отделение` (nova poshta), `Адрес` (такси).
  - `applyTemplate(text: string, current: OrderFields, now: Date): { ok: true; fields: OrderFields; changed: string[] } | { ok: false; error: string }` — `changed` — русские названия изменённых полей в нижнем регистре (`"телефон"`, `"дата"`, …).
  - `setFieldLines(caption: string, f: OrderFields, shipByDay?: string): string` — заменяет строки клиента, телефона, срочности, даты и блок доставки; всё остальное (заголовок с тегом 2 брелков, блок второго брелка, `🌐`, `📣`, `📝`, `🕒`, `🤖`) остаётся на местах.
- Метки шаблона: `Имя`; `Телефон`|`Тел`; `Нужен к`|`Дата`; `Срочно`; `Способ`|`Доставка`; `Индекс`; `Город`|`Село`; `Район`; `Улица`; `Отделение`; `Адрес`. Регистр и пробелы не важны; отсутствующая строка = без изменений; пустое значение очищает только `Улица`/`Дата`.
- Ошибки `applyTemplate` (тексты для чата): `"Не понял способ: «…». Варианты: самовывоз, почта, nova poshta, такси, уточнит"`, `"Для почты нужны: индекс, город, район"`, `"Для Nova Poshta нужен номер отделения"`, `"Для такси нужен адрес"`, `"Дата — в виде ДД.ММ, например 21.11"`, `"Срочно — только самовывоз или такси"`. Если `Срочно: да` и дата не указана — дата = сегодня. Телефон в шаблоне хранится как ввёл менеджер (`cleanText`, 40 символов) — менеджеру ограничения формы не нужны.

- [ ] **Step 1: Write the failing tests** (подписи — реальные из выгрузки, `now = 2026-11-15T10:00:00Z`):

```ts
const OLD_POST = "🔥 Новый заказ #YRQ5EQ\n👤 Клиент: Илья\n🏠 Улица: 77828888\n🏘 Район: Мечникова 31\n📮 Индекс: 3300\n🏙 Город: Тирасполь\n📞 Тел: 60790351\n📣 Источник: переход с l.instagram.com\n🚚 Способ получения: Poșta Moldovei — 30 лей\n🕒 14.11 09:40 · ✏️ Доставка изменена\n📝 ОПЛАЧЕНО 280 ЛЕЙ";
const UPSELL = "🔥 Новый заказ #X46XXY — ⚠️ 2 БРЕЛКА\n━━━━━━━━━━━━━━━\n⚠️ ВТОРОЙ БРЕЛОК\nПоложите в заказ 2 штуки\nСтоимость: 400 лей плюс доставка\n━━━━━━━━━━━━━━━\n👤 Клиент: Виктория\n📞 Тел: 079797981\n🌐 Клиент оформлял на румынском (по возможности говорите по-румынски)\n📣 Источник: переход с instagram.com\n🚚 Способ получения: Самовывоз\n📝 заметка";
const VERY_OLD = "🔥 Новый заказ #95TZYC\n👤 Клиент: Андрей\n📞 Тел: 079178354\n📸 Фотографий: 10 шт.\n🚚 Способ получения: Poșta Moldovei — 30 лей\n📮 Индекс: 5642\n🏘 Vasileuți, р-н Рышканы";

test("reads fields from current caption", () => {
  const f = fieldsFromCaption(OLD_POST, now);
  assert.equal(f.method, "posta"); assert.equal(f.postalCode, "3300"); assert.equal(f.city, "Тирасполь");
  assert.equal(f.phone, "60790351"); assert.equal(f.urgent, false);
});
test("reads old 'Город, р-н Район' format", () => {
  const f = fieldsFromCaption(VERY_OLD, now);
  assert.equal(f.city, "Vasileuți"); assert.equal(f.district, "Рышканы");
});
test("template round-trips", () => {
  const f = fieldsFromCaption(OLD_POST, now);
  const r = applyTemplate(fieldsTemplate(f), f, now);
  assert.ok(r.ok); assert.deepEqual(r.fields, f); assert.deepEqual(r.changed, []);
});
test("labels: any case, aliases, order, missing lines", () => {
  const f = fieldsFromCaption(OLD_POST, now);
  const r = applyTemplate("район: Тирасполь\n  УЛИЦА :  Мечникова 31\nтел: +373 77828888", f, now);
  assert.ok(r.ok);
  assert.equal(r.fields.street, "Мечникова 31"); assert.equal(r.fields.district, "Тирасполь");
  assert.equal(r.fields.phone, "+373 77828888"); assert.equal(r.fields.postalCode, "3300");
  assert.deepEqual(r.changed.sort(), ["район", "телефон", "улица"]);
});
test("method switch requires its fields", () => {
  const f = fieldsFromCaption(UPSELL, now);
  assert.equal((applyTemplate("Способ: почта", f, now) as { error: string }).error, "Для почты нужны: индекс, город, район");
  assert.ok(applyTemplate("Способ: такси\nАдрес: Колумна 5\nСрочно: да", f, now).ok);
  assert.equal((applyTemplate("Способ: ракета", f, now) as { ok: boolean }).ok, false);
});
test("urgent yes without date means today", () => {
  const r = applyTemplate("Срочно: да", fieldsFromCaption(UPSELL, now), now);
  assert.ok(r.ok); assert.equal(r.fields.wantedDate, "2026-11-15");
});
test("setFieldLines keeps upsell block, language, source, notes", () => {
  const f = { ...fieldsFromCaption(UPSELL, now), phone: "060000000", wantedDate: "2026-11-21" };
  const out = setFieldLines(UPSELL, f);
  assert.ok(out.startsWith("🔥 Новый заказ #X46XXY — ⚠️ 2 БРЕЛКА\n━━━━━━━━━━━━━━━\n⚠️ ВТОРОЙ БРЕЛОК"));
  for (const keep of ["🌐 Клиент оформлял", "📣 Источник", "📝 заметка"]) assert.ok(out.includes(keep), keep);
  assert.ok(out.includes("📞 Тел: 060000000")); assert.ok(out.includes("📅 Нужен к: пт 21.11"));
  assert.equal(out.split("\n").filter((l) => l.startsWith("📞")).length, 1);
});
test("urgent and post lines", () => {
  const f = { ...fieldsFromCaption(UPSELL, now), urgent: true, wantedDate: "2026-11-15" };
  assert.ok(setFieldLines(UPSELL, f).includes("⚡ СРОЧНО +100 лей · на сегодня 15.11"));
  const p = { ...fieldsFromCaption(OLD_POST, now), wantedDate: "2026-11-21" };
  assert.ok(setFieldLines(OLD_POST, p, "2026-11-19").includes("📅 Нужен к: пт 21.11 · отправить до: чт 19.11"));
});
```

- [ ] **Step 2: Run** — `npm test` → FAIL.
- [ ] **Step 3: Implement** `lib/order-fields.ts`, затем перенос из `telegram-orders.ts` с реэкспортом. Строку `⚡ СРОЧНО …` ставить сразу после блока второго брелка (или после заголовка, если блока нет); `📅` — сразу после `📞`. «Отправить до» в `setFieldLines` пишется только при переданном `shipByDay` и способе почта/nova poshta; при правке в боте `shipByDay` для почты берётся из старой строки, если дата не менялась, иначе = `wantedDate − 3 дня`.
- [ ] **Step 4: Run** — `npm test` → PASS; `npx tsc --noEmit` → без ошибок (после `npm install`).
- [ ] **Step 5: Commit** — `git commit -m "Поля заказа: чтение из подписи, шаблон правки, пересборка подписи"`

### Task 4: API заказа (`app/api/order/route.ts`)

**Files:**
- Modify: `app/api/order/route.ts`

**Interfaces:**
- Consumes: `validateWanted`, `earliestDate`, `shipBy`, `chisinauToday` (Task 1); `normalizeMdPhone`, `formatMdPhone` (Task 2); `buildOrderCaption({ …, urgent, wantedDate, shipBy })` (Task 3).
- Produces: тело запроса принимает `wantedDate: string` (обязательно) и `urgent: boolean`; `delivery.method === "taxi"` допустим только при `urgent`.

- [ ] **Step 1: Add validation** после проверки доставки: `validateWanted({ method, wantedDate, urgent, now: new Date(), graceMinutes: 30 })`; ответы 400 (RU/RO через `t`):
  - `format`/`too_far` → «Выберите дату получения» / «Alege data primirii»
  - `too_early` → «Эта дата уже недоступна — выберите другую» / «Această dată nu mai este disponibilă — alege alta»
  - `urgent_post`/`urgent_date` → «Срочно — только самовывоз или такси на сегодня» / «Urgent — doar ridicare sau taxi pentru azi»
  - `urgent_late` → «Срочные заказы на сегодня принимаем до 18:00. Выберите завтра» / «Comenzile urgente pentru azi le primim până la 18:00. Alege mâine»
  - taxi без `urgent` → «Такси — только для срочных заказов» / «Taxiul — doar pentru comenzi urgente»
- [ ] **Step 2: Phone** — `normalizeMdPhone(phone)`; при `!ok` → 400 «Проверьте номер телефона» / «Verifică numărul de telefon»; в подпись — `formatMdPhone(digits)`.
- [ ] **Step 3: Caption** — передать `urgent`, `wantedDate`, `shipBy: method is posta|novapost ? shipBy(now) : undefined` в `buildOrderCaption`.
- [ ] **Step 4: Verify** — `npx tsc --noEmit` и `npm run lint` без ошибок; `npm test` PASS.
- [ ] **Step 5: Commit** — `git commit -m "Заказ: желаемая дата, срочность, такси, проверка телефона"`

### Task 5: Бот — «✏️ Изменить» (`lib/telegram-bot.ts`, `lib/telegram-orders.ts`)

**Files:**
- Modify: `lib/telegram-orders.ts` (`keyboard`: кнопка `✏️ Изменить`, `callback_data: "ed"`, вместо `✏️ Доставка`; удалить `deliveryMenu`)
- Modify: `lib/telegram-bot.ts`

**Interfaces:**
- Consumes: `fieldsFromCaption`, `fieldsTemplate`, `applyTemplate`, `setFieldLines` (Task 3); `historyLine`, `appendLine`, `applyCaption` (существующие).

- [ ] **Step 1: Callback** — `"ed"` и старый `"edm"` (кнопки в старых сообщениях) → `askDetails(msg, "e", userId)`. Убрать ветки `set` и `esc`, `PROMPTS.s/n/t`, `parseDetails`.
- [ ] **Step 2: Prompt** — для `kind === "e"` текст запроса: `"Скопируйте блок (нажмите на него), исправьте нужное и отправьте ответом. Строки без изменений можно удалить."`, затем шаблон `fieldsTemplate(fieldsFromCaption(caption, now))`; шаблон помечен entity `{ type: "pre" }` (offset/length в UTF-16 — `String.length`). Шаблон не содержит пустых строк (иначе ломается `PROMPT_RE`). `input_field_placeholder: "Вставьте исправленный блок"`.
- [ ] **Step 3: Reply** — в `handleReply` для `"e"`: `applyTemplate(msg.text, fieldsFromCaption(caption, now), now)`; ошибка → существующий путь предупреждения (UserError); `changed` пустой → предупреждение «Ничего не изменилось»; иначе `next = appendLine(setFieldLines(caption, fields, shipByDay), historyLine("✏️ Изменено: " + changed.join(", ")))`, `deliveryChanged = changed.includes("способ")`, `applyCaption(...)`.
- [ ] **Step 4: Verify** — `npx tsc --noEmit`, `npm run lint`, `npm test` PASS. Ручная проверка в группе после деплоя превью — Task 7.
- [ ] **Step 5: Commit** — `git commit -m "Бот: кнопка «Изменить» — правка всех данных заказа по шаблону"`

### Task 6: Форма (`components/OrderModal.tsx`, `components/WantedDatePicker.tsx`, `lib/i18n.ts`, `components/PhotoConstructor.tsx`)

**Files:**
- Create: `components/WantedDatePicker.tsx`
- Modify: `components/OrderModal.tsx`, `lib/i18n.ts` (`DeliveryMethod` + `"taxi"`; новые строки в `orderModal`), `components/PhotoConstructor.tsx` (передать `wantedDate`, `urgent` в `/api/order`)

**Interfaces:**
- Consumes: `earliestDate`, `addDays`, `chisinauToday`, `urgentOpen`, `formatDay`, `shipBy` (Task 1); `normalizeMdPhone` (Task 2); `MD_DISTRICTS` (Task 2).
- Produces: `OrderModal` `onSubmit` получает дополнительно `wantedDate: string; urgent: boolean`; `DeliveryData.method` может быть `"taxi"` с `address`.
- `WantedDatePicker` props: `{ method: "pickup" | "posta" | "novapost"; value: { date: string; urgent: boolean } | null; onChange(v: { date: string; urgent: boolean } | null): void; lang: "ru" | "ro"; error?: string }`.

- [ ] **Step 1: i18n** — строки RU/RO (точные тексты из spec): «Когда заберёте?» / «Când ridici?», «К какой дате хотите получить?» / «Până când vrei să primești?», «Завтра» / «Mâine», «Послезавтра» / «Poimâine», «Другая дата» / «Altă dată», «⚡ Сегодня — срочно, +100 лей» / «⚡ Azi — urgent, +100 lei», «Подтвердим в чате, успеваем ли» / «Confirmăm în chat dacă reușim», «Изготовим и отправим за 1–2 рабочих дня, почта идёт до 3 дней» / «Facem și expediem în 1–2 zile lucrătoare, poșta merge până la 3 zile», «Как получите?» / «Cum primești?», «Заберу сам — Bernardazzi 64» / «Ridic eu — Bernardazzi 64», «Такси по Кишинёву — оплачиваете водителю» / «Taxi prin Chișinău — plătești șoferului», «Адрес» / «Adresa», «Выберите дату» / «Alege data», ошибки телефона «В номере {n} цифр, нужно 8» / «Numărul are {n} cifre, trebuie 8», «Номер должен быть молдавским (+373)» / «Numărul trebuie să fie din Moldova (+373)». `postaPrice` → «30 лей», `novapostPrice` → «60 лей» (сроки теперь в блоке даты).
- [ ] **Step 2: WantedDatePicker** — «таблетки» как карточки способа (`methodCardClass`): для самовывоза — завтра и послезавтра (`formatDay`), для почты — `earliestDate` и следующий день; «Другая дата» — `<input type="date" min={earliest} max={today+90}>`; «Сегодня» только для `pickup` и при `urgentOpen(new Date())`. Пересчёт «сейчас» при открытии формы.
- [ ] **Step 3: OrderModal** — порядок: имя → телефон → способ → дата → (при срочном: «Как получите?», такси → адрес, обязательно) → второй брелок → согласия. Телефон: неизменяемый префикс `+373` слева от поля, `inputMode="numeric"`, ошибка из `normalizeMdPhone` на blur и при отправке. Индекс: `inputMode="numeric"`, `maxLength={4}`, только цифры, placeholder `MD-____`→ подпись. Район: `<select>` из `MD_DISTRICTS` (подпись по языку). Все поля `autoComplete="off"`, `name` — нестандартные (`f_n`, `f_p`, …). Смена способа сбрасывает дату, если она раньше `earliestDate` нового способа, и всегда сбрасывает срочность/такси при уходе с самовывоза. Дата и (при срочном такси) адрес — в `validate()`/`FIELD_ORDER`. Отправляется: `method: urgentTaxi ? "taxi" : method`, `address` для такси, `wantedDate`, `urgent`.
- [ ] **Step 4: PhotoConstructor** — прокинуть `wantedDate`, `urgent` из `userData` в тело `/api/order`.
- [ ] **Step 5: Verify** — `npm run build` и `npm run lint` без ошибок. Затем `npm run start` и Playwright-скрипт (в scratchpad, телефон 390×844, RU и RO): открыть форму → самовывоз → выбрать «Сегодня» → выбрать такси → переключить на Poșta: срочность, такси и дата сброшены, первая дата = `earliestDate("posta", now)`; ввести телефон `069708505` → без ошибки, `6970850` → «В номере 7 цифр, нужно 8»; скриншоты для проверки вида. Отправку не делать (уйдёт в боевой Telegram).
- [ ] **Step 6: Commit** — `git commit -m "Форма: дата получения, срочно и такси, телефон +373, районы списком, без автозаполнения"`

### Task 7: Документация и проверка целиком

**Files:**
- Modify: `README.md` (раздел конструктора: шаг «Заказ» — дата/срочность; раздел бота: «✏️ Изменить» вместо «✏️ Доставка», как пользоваться шаблоном; `npm test`)

- [ ] **Step 1: README** — обновить описание формы и бота.
- [ ] **Step 2: Full check** — `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` → всё без ошибок.
- [ ] **Step 3: Commit and push** — `git commit -m "README: дата получения и правка заказа в боте"`, `git push -u origin claude/hopeful-shannon-5y3oen`.
- [ ] **Step 4: Проверка владельцем** — на превью-деплое Vercel ветки: тестовый заказ (пометить имя «ТЕСТ»), нажать «✏️ Изменить», поменять телефон, дату и способ на почту; заказ переехал в нужную тему и историю дописалось «✏️ Изменено: …».
