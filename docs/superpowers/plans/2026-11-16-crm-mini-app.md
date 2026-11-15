# CRM заказов (Telegram Mini App) — план

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** мини-CRM на двоих внутри Telegram: все заказы в Supabase, доска из 4 стадий, правка каждого поля, комментарии, мгновенное скачивание PDF — без единого удаления сообщений и файлов.

**Architecture:** раздел сайта `/crm` (клиентская страница) открывается как Mini App; все данные идут через API-маршруты `/api/crm/*`, которые проверяют Telegram `initData` и работают с Supabase сервисным ключом. Чистая логика (вход, модель заказа, подпись в чате) — в `lib/crm/*.ts` с тестами `node --test`; работа с Supabase и Telegram — тонкие серверные обёртки.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind 4, Supabase (Postgres + Storage, `@supabase/supabase-js`), Telegram Bot API и Mini Apps (`telegram-web-app.js`).

**Spec:** `docs/superpowers/specs/2026-11-16-crm-mini-app-design.md`

## Global Constraints

- **Никаких удалений**: ни `deleteMessage` для сообщений с заказами, ни удаления файлов в Storage, ни `DELETE`/`.delete()` по таблицам `crm_*`. Охраняется тестом из Task 1.
- Supabase-проект `uvuavmzrxtyvsytzjywk` (Wasilevz's Project). Таблица `public.orders` не трогается. Новые таблицы — `crm_orders`, `crm_comments`, `crm_history`; бакет `order-pdfs` (приватный).
- Сервисный ключ только на сервере (`SUPABASE_SERVICE_ROLE_KEY`, без префикса `NEXT_PUBLIC_`). RLS на `crm_*` включён без политик.
- Доступ: `CRM_ALLOWED_USER_IDS` (через запятую); пустая → закрыто всем. `initData` не старше 24 ч. `CRM_DEV_USER_ID` — только при `NODE_ENV !== "production"`.
- Стадии и подписи: `new` «🆕 Новые», `production` «🛠 В производстве», `ready` «📦 Готов к выдаче» (pickup/taxi/later) / «📦 Готов к отправке» (posta/novapost), `done` «✅ Завершён».
- Цена по умолчанию: `250 + 150·(qty−1) + (urgent ? 100 : 0)`; поле `price` перекрывает.
- Ссылка Mini App: `https://t.me/${TELEGRAM_BOT_USERNAME}/crm?startapp=${code}`.
- Новая зависимость — только `@supabase/supabase-js`. Перетаскивание — нативный HTML5 DnD на ширине ≥ 1024 px.
- Интерфейс CRM — только русский. Тесты — `npm test` (`node --test "lib/**/*.test.ts"`), модули `lib/crm/*` импортируют друг друга с расширением `.ts`.
- Время — `Europe/Chisinau` (функции из `lib/delivery-dates.ts`).

## Review Focus

1. Сбой Supabase при новом заказе (нет ключей, сеть, дубль кода) — заказ всё равно уходит в Telegram с пометкой `⚠️ Не записан в CRM`. → тест в Task 6 (чистая функция выбора подписи/клавиатуры).
2. Подделанный, просроченный или чужой `initData` (другой user id, изменённое поле, `auth_date` вчера+) → 401/403, данные не отдаются. → тесты в Task 3.
3. Два человека правят один заказ одновременно — побеждает последнее сохранение, но история пишет оба изменения; поле, которое не правили, не затирается (PATCH только переданных полей). → тест в Task 4 (`applyPatch`).
4. Подпись сообщения в чате длиннее 1024 символов после правок / сообщение не найдено — сохранение в CRM всё равно успешно, ошибка Telegram только в лог. → тест в Task 5.
5. Нажатие старых кнопок под прошлыми заказами (Готов/Выдан/Назад/Изменить/…) — ничего не удаляется и не переносится, ответ «Заказы теперь ведутся в CRM». → тест в Task 1 (сканер удалений) + ручная проверка в Task 10.

---

### Task 1: Бот больше ничего не удаляет (сделать первым и выкатить сразу)

**Files:**
- Modify: `lib/telegram-bot.ts` (убрать `moveOrder`, `transition`, `applyCaption`-перенос, ветки `rdy/fin/back/ed/edm/nt/ups/upsx/esc`, `handleReply` для правок и заметок)
- Modify: `lib/telegram-orders.ts` (удалить `keyboard()` и меню; кнопка CRM живёт в `lib/crm/links.ts`)
- Create: `lib/crm/links.ts`, Test: `lib/crm/links.test.ts`, `lib/no-deletes.test.ts`

**Interfaces:**
- Produces: `crmAppUrl(code: string, botUsername: string | undefined): string | null` — `null`, если имени бота нет; `type UrlButton = { text: string; url: string }`; `crmKeyboard(code: string): UrlButton[][]` (читает `process.env.TELEGRAM_BOT_USERNAME`; пусто, если ссылки нет — до настройки CRM заказы приходят без кнопок) — `[[{ text: "📋 Открыть в CRM", url }]]`.

- [ ] **Step 1: Failing tests**
```ts
// lib/crm/links.test.ts
test("crm link", () => {
  assert.equal(crmAppUrl("7AZER9", "photobrelok_bot"), "https://t.me/photobrelok_bot/crm?startapp=7AZER9");
  assert.equal(crmAppUrl("7AZER9", undefined), null);
});
// lib/no-deletes.test.ts — сканирует lib/**/*.ts, app/**/*.ts(x), components/**/*.tsx (кроме *.test.ts)
test("no deletes of orders, files or rows", () => {
  // разрешено: "deleteMessage" только внутри функции deleteLater в lib/telegram-bot.ts (служебные подсказки бота)
  // и в notifyUpsell в app/api/telegram/route.ts (служебное уведомление). Больше нигде.
  // запрещено везде: ".remove(" у storage, ".delete()" у supabase, "moveOrder".
});
```
- [ ] **Step 2: Run** `npm test` → FAIL (`moveOrder`/`deleteMessage` в `moveOrder`, модуль ссылок отсутствует).
- [ ] **Step 3: Implement.** Любой callback от старых кнопок: `answerCallbackQuery` с текстом «Заказы теперь ведутся в CRM — откройте заказ кнопкой под сообщением» и, если код заказа найден в подписи (`#XXXXXX`) и есть `TELEGRAM_BOT_USERNAME`, `editMessageReplyMarkup` на `crmKeyboard(code)`. `/id` остаётся (в личке отвечает id пользователя — нужен для `CRM_ALLOWED_USER_IDS`). Ответы-правки и заметки (`handleReply`) убрать. `app/api/order/route.ts`: вместо `keyboard("work", …)` — `crmKeyboard(orderId)` (пустой → без клавиатуры).
- [ ] **Step 4: Verify** `npm test` PASS, `npx tsc --noEmit`, `npm run lint`, `npm run build` без ошибок.
- [ ] **Step 5: Commit** `Бот: никаких удалений и переносов, кнопка «Открыть в CRM»`

### Task 2: Таблицы и хранилище в Supabase

**Files:**
- Create: `supabase/migrations/20261116000000_crm.sql`
- Modify: `.env.example` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRM_ALLOWED_USER_IDS`, `TELEGRAM_BOT_USERNAME`, `CRM_DEV_USER_ID`), `package.json` (`@supabase/supabase-js`)

**Interfaces:**
- Produces: таблицы ровно по разделу «Данные» спеки (`crm_orders` с `tg_caption`, `crm_comments`, `crm_history`), индексы `crm_orders(stage)`, `crm_orders(created_at desc)`, `crm_comments(order_id)`, `crm_history(order_id)`; триггер `updated_at`; RLS включён без политик; бакет `order-pdfs` (`public = false`, `allowed_mime_types = {application/pdf}`, лимит 20 МБ).

- [ ] **Step 1: Write migration** (только `create … if not exists`, ни одного `drop`/`delete`/`truncate`).
- [ ] **Step 2: Apply** через Supabase MCP `apply_migration` к проекту `uvuavmzrxtyvsytzjywk`.
- [ ] **Step 3: Verify** `list_tables` показывает 3 новые таблицы с RLS, `public.orders` без изменений (0 строк, те же 7 колонок); `get_advisors` (security) — без новых критичных замечаний.
- [ ] **Step 4: Commit** `Supabase: таблицы CRM и приватный бакет PDF`

### Task 3: Вход через Telegram (`lib/crm/auth.ts`)

**Files:** Create `lib/crm/auth.ts`, Test `lib/crm/auth.test.ts`

**Interfaces:**
- Produces:
  - `type CrmUser = { id: number; name: string }`
  - `verifyInitData(initData: string, botToken: string, nowSec: number, maxAgeSec = 86400): { ok: true; user: CrmUser } | { ok: false; reason: "bad_signature" | "expired" | "no_user" | "malformed" }` — алгоритм Telegram: `secret = HMAC_SHA256(key="WebAppData", botToken)`, `hash = hex(HMAC_SHA256(secret, data_check_string))`, строки `key=value` без `hash`, по алфавиту, через `\n`; сравнение `timingSafeEqual`. `name` = `first_name [last_name]`.
  - `parseAllowed(raw: string | undefined): Set<number>`
  - `authorize(initData: string | null, env: { botToken?: string; allowed?: string; devUserId?: string; nodeEnv?: string }, nowSec: number): { ok: true; user: CrmUser } | { ok: false; status: 401 | 403 }`

- [ ] **Step 1: Failing tests** — хелпер `sign(fields, token)` в тесте строит корректный `initData`.
```ts
test("valid initData passes", () => assert.deepEqual(verifyInitData(sign({ auth_date: "1794780000", user: JSON.stringify({ id: 42, first_name: "Вася" }) }, T), T, 1794780100), { ok: true, user: { id: 42, name: "Вася" } }));
test("tampered field fails", …"bad_signature");
test("other bot token fails", …"bad_signature");
test("older than 24h fails", …nowSec = auth_date + 86401 → "expired");
test("authorize: not in allowlist → 403, empty allowlist → 403, no initData → 401", …);
test("dev user only outside production", () => {
  assert.equal(authorize(null, { devUserId: "42", allowed: "42", nodeEnv: "development" }, now).ok, true);
  assert.deepEqual(authorize(null, { devUserId: "42", allowed: "42", nodeEnv: "production" }, now), { ok: false, status: 401 });
});
```
- [ ] **Step 2: Run** `npm test` → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `CRM: проверка входа через Telegram initData`

### Task 4: Модель заказа (`lib/crm/model.ts`)

**Files:** Create `lib/crm/model.ts`, Test `lib/crm/model.test.ts`

**Interfaces:**
- Consumes: `OrderFields`, `DeliveryMethod` из `lib/order-fields.ts`; `normalizeMdPhone`, `formatMdPhone` из `lib/phone.ts`; `isDay`, `earliestDate`, `chisinauToday` из `lib/delivery-dates.ts`.
- Produces:
  - `type Stage = "new" | "production" | "ready" | "done"`; `STAGES: Stage[]`
  - `type CrmOrder = { code: string; createdAt: string; stage: Stage; stageChangedAt: string; name: string; phone: string; wantedDate: string | null; urgent: boolean; method: DeliveryMethod; postalCode: string | null; city: string | null; district: string | null; street: string | null; branch: string | null; address: string | null; qty: number; price: number | null; lang: "ru" | "ro"; source: string | null; pdfPath: string | null; tgChatId: number | null; tgMessageId: number | null; tgCaption: string | null; flags: string[]; commentsCount: number }`
  - `stageLabel(stage: Stage, method: DeliveryMethod): string`; `nextStage(s): Stage | null`; `prevStage(s): Stage | null`
  - `orderPrice(o: Pick<CrmOrder, "qty" | "urgent" | "price">): number`
  - `sortOrders(list: CrmOrder[]): CrmOrder[]`
  - `type OrderPatch = Partial<Pick<CrmOrder, "name" | "phone" | "wantedDate" | "urgent" | "method" | "postalCode" | "city" | "district" | "street" | "branch" | "address" | "qty" | "price" | "stage">>`
  - `applyPatch(current: CrmOrder, patch: OrderPatch, now: Date): { ok: true; next: CrmOrder; changed: (keyof OrderPatch)[]; warnings: string[] } | { ok: false; error: string }`
  - `toFields(o: CrmOrder): OrderFields` (для `setFieldLines`)
  - `rowToOrder(row: Record<string, unknown>): CrmOrder`, `orderToRow(o: Partial<CrmOrder>): Record<string, unknown>` (snake_case ↔ camelCase)

- [ ] **Step 1: Failing tests** (точные значения):
```ts
test("labels", () => { assert.equal(stageLabel("ready", "posta"), "📦 Готов к отправке"); assert.equal(stageLabel("ready", "pickup"), "📦 Готов к выдаче"); });
test("price", () => { assert.equal(orderPrice({ qty: 1, urgent: false, price: null }), 250); assert.equal(orderPrice({ qty: 3, urgent: true, price: null }), 650); assert.equal(orderPrice({ qty: 3, urgent: false, price: 600 }), 600); });
test("sort: urgent, then nearest date, no date last, then oldest first", …);
test("patch touches only given fields and lists changes", () => { /* patch {phone:"069708505"} → next.phone "+373 69 708 505", name unchanged, changed ["phone"] */ });
test("patch errors", () => {
  // phone "123" → "Проверьте номер телефона"; method "posta" без postalCode/city/district → "Для почты нужны: индекс, город, район";
  // novapost без branch → "Для Nova Poshta нужен номер отделения"; taxi без address → "Для такси нужен адрес";
  // urgent true + posta → "Срочно — только самовывоз или такси"; qty 0 или 21 → "Количество — от 1 до 20"; name "" → "Имя не может быть пустым"
});
test("patch warns on early date but saves", () => { /* posta, wantedDate = today → ok, warnings ["Дата раньше ближайшей для почты"] */ });
test("method change clears other method fields", …);
test("row mapping round-trips", …);
```
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `CRM: модель заказа, стадии, цена, проверка правок`

### Task 5: Подпись в чате из данных CRM (`lib/crm/caption.ts`)

**Files:** Create `lib/crm/caption.ts`, Test `lib/crm/caption.test.ts`

**Interfaces:**
- Consumes: `setFieldLines` (`lib/order-fields.ts`), `appendLine` (`lib/telegram-orders.ts` — перенести в `lib/order-fields.ts`, если импорт тянет `node:crypto`; реэкспорт оставить), `toFields`, `stageLabel`, `CrmOrder`.
- Produces: `buildCrmCaption(o: CrmOrder): string` — берёт `o.tgCaption`, применяет `setFieldLines(caption, toFields(o), shipBy?)`, ставит/заменяет строку `📌 Стадия: <stageLabel>` сразу после заголовка/блока второго брелка, при `qty ≥ 2` — строку `🔑 Брелков: N` рядом, убирает устаревшую строку `🔑`, укладывает в 1000 символов, срезая сначала самые старые строки `🕒`.

- [ ] **Step 1: Failing tests** — на реальных подписях (`UPSELL`, `OLD_POST` из `lib/order-fields.test.ts`): строка стадии одна и обновляется; `🌐`, `📣`, `📝` сохраняются; при `qty: 3` — `🔑 Брелков: 3`; подпись ≤ 1000 при 30 строках истории; `tgCaption: null` → строится из `buildOrderCaption`-подобной базы `🔥 Заказ #CODE`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `CRM: подпись сообщения в чате из данных заказа`

### Task 6: Сервер — Supabase и Telegram (`lib/crm/db.ts`, `lib/crm/telegram.ts`) и заказ с сайта

**Files:**
- Create: `lib/crm/db.ts`, `lib/crm/telegram.ts`, `lib/crm/order-intake.ts`, Test `lib/crm/order-intake.test.ts`
- Modify: `app/api/order/route.ts`, `app/api/telegram/route.ts` (апселл → `qty = 2`)

**Interfaces:**
- Produces (`db.ts`, `import "server-only"`-стиль: используется только из API):
  - `crmEnabled(): boolean` (есть `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY`)
  - `insertOrder(o: Omit<CrmOrder, "commentsCount">): Promise<void>`; `getOrder(code): Promise<CrmOrder | null>`; `listOrders(opts: { doneDays: number; q?: string }): Promise<CrmOrder[]>`; `saveOrder(code, row: Record<string, unknown>): Promise<void>` (только `update`)
  - `addHistory(code, actor: CrmUser | null, action: "created" | "imported" | "stage" | "field" | "comment", details: object)`; `addComment(code, actor: CrmUser, text: string)`; `listComments(code)`; `listHistory(code)`
  - `uploadPdf(code: string, pdf: Buffer): Promise<string>` — `upload(..., { upsert: false })`, при конфликте `<code>-2.pdf`, `-3`…; `signedPdfUrl(path: string, code: string): Promise<string>` — 600 с, `download: "Brelok_<code>.pdf"`
- Produces (`telegram.ts`): `syncOrderMessage(o: CrmOrder): Promise<void>` — `editMessageCaption` с `buildCrmCaption` и `crmKeyboard`, сохраняет новую `tg_caption`; ошибки только в лог. `sendPdfTo(userId: number, o: CrmOrder): Promise<"sent" | "start_bot" | "no_pdf">` — `copyMessage` из `tgChatId/tgMessageId`, иначе `sendDocument` из Storage; ошибка «bot can't initiate conversation» → `"start_bot"`.
- Produces (`order-intake.ts`, чистая): `intakeCaption(caption: string, savedToCrm: boolean): string` — при `false` дописывает `⚠️ Не записан в CRM`.
- `app/api/order/route.ts`: порядок — собрать PDF → `insertOrder` + `uploadPdf` + `addHistory("created")` в `try` (флаг `saved`) → отправить в Telegram с `intakeCaption` и `crmKeyboard` → `saveOrder` с `tg_chat_id`/`tg_message_id`/`tg_caption` (только для группы с темами). Ни одна ошибка CRM не меняет ответ клиенту.

- [ ] **Step 1: Failing test** `intakeCaption` (оба случая).
- [ ] **Step 2–4:** FAIL → implement → PASS; `npx tsc --noEmit`, `npm run build`.
- [ ] **Step 5: Manual check** с `.env.local` (ключи проекта): `node` скрипт в scratchpad вызывает `insertOrder` для кода `TEST01` → строка видна через Supabase MCP `execute_sql select code, stage from crm_orders where code='TEST01'`. Тестовую строку **не удалять** — перевести в `done` и добавить флаг `test`.
- [ ] **Step 6: Commit** `CRM: запись заказов с сайта в Supabase и PDF в хранилище`

### Task 7: API CRM (`app/api/crm/...`)

**Files:**
- Create: `lib/crm/api.ts` (`requireUser(req): Promise<CrmUser | Response>` через `authorize` с заголовком `X-Telegram-Init-Data`)
- Create: `app/api/crm/orders/route.ts` (GET список: `?q=`, `?doneDays=30`)
- Create: `app/api/crm/orders/[code]/route.ts` (GET заказ + комментарии + история; PATCH `OrderPatch` → `applyPatch` → `saveOrder` → `addHistory("field"|"stage")` → `syncOrderMessage`; ответ `{ order, warnings }`)
- Create: `app/api/crm/orders/[code]/comments/route.ts` (POST `{ text }` 1…1000 символов)
- Create: `app/api/crm/orders/[code]/pdf/route.ts` (GET → `{ url }` или 404, если `pdfPath` нет)
- Create: `app/api/crm/orders/[code]/send-pdf/route.ts` (POST → `{ result: "sent" | "start_bot" | "no_pdf" }`)

Все маршруты: `export const dynamic = "force-dynamic"`, без кэша, `code` проверяется `/^[A-HJ-NP-Z2-9]{6}$/` (у импортированных старых кодов — тот же алфавит; при несовпадении — 400). Ни одного метода DELETE.

- [ ] **Step 1: Verify** `npx tsc --noEmit`, `npm run lint`, `npm test` (сканер удалений из Task 1 видит новые файлы).
- [ ] **Step 2: Manual check** `npm run dev` с `CRM_DEV_USER_ID` = id из `CRM_ALLOWED_USER_IDS`: `curl` GET список → 200 и `TEST01`; PATCH `{ "stage": "production" }` → 200; без заголовка в production-сборке (`npm run build && npm start`) → 401.
- [ ] **Step 3: Commit** `CRM: API заказов, комментариев и PDF`

### Task 8: Интерфейс `/crm`

**Files:**
- Create: `app/crm/layout.tsx` (подключает `https://telegram.org/js/telegram-web-app.js` через `next/script` `beforeInteractive`; `robots: noindex`)
- Create: `app/crm/page.tsx` (`"use client"`), `components/crm/useCrmApi.ts`, `components/crm/Board.tsx`, `components/crm/OrderListItem.tsx`, `components/crm/OrderSheet.tsx`, `components/crm/FieldRow.tsx`, `components/crm/DeliveryEditor.tsx`, `components/crm/PdfButtons.tsx`
- Modify: `app/sitemap.ts`/`robots` — `/crm` не индексируется.

**Interfaces:**
- Consumes: API из Task 7; `stageLabel`, `sortOrders`, `orderPrice`, `nextStage`, `prevStage` (Task 4); `MD_DISTRICTS`, `formatDay` — для отображения.
- `useCrmApi()` — `fetch` c заголовком `X-Telegram-Init-Data: window.Telegram.WebApp.initData`; опрос списка каждые 20 с при `document.visibilityState === "visible"`.
- `startapp`: `Telegram.WebApp.initDataUnsafe.start_param` → открыть карточку этого кода.
- PDF: `PdfButtons` — «⬇️ Скачать PDF» (`Telegram.WebApp.downloadFile({ url, file_name })` если `isVersionAtLeast("8.0")`, иначе `openLink(url)`), «📩 Прислать в Telegram» (POST send-pdf; `start_bot` → подсказка «Откройте @<бот> и нажмите Start, затем повторите»). Иконка ⬇️ также на карточке в списке.
- Без Telegram и без dev-режима — экран «Откройте CRM через Telegram» (401/403 → «Нет доступа. Попросите добавить ваш id: …»).
- Вид — по разделу «Доска» и «Карточка» спеки и эскизам из обсуждения: телефон — вкладки со счётчиками; ≥ 1024 px — 4 колонки и drag&drop (`draggable`, `onDrop` → PATCH stage). Кнопки «→ <следующая>» / «← назад» в карточке. `Telegram.WebApp.ready()`, `expand()`; `BackButton` закрывает карточку.

- [ ] **Step 1: Implement**.
- [ ] **Step 2: Verify** `npm run build`, `npm run lint`. Playwright (scratchpad, 390×844 и 1280×800) против `npm run dev` с `CRM_DEV_USER_ID`: доска загрузилась, `TEST01` во вкладке «🛠 В производстве»; открыть карточку, поменять телефон → сохранено; способ «почта» → появились индекс/город/район; добавить комментарий → виден; на 1280 перетащить в «📦 Готов» → стадия сменилась; скриншоты посмотреть глазами. Кнопки PDF проверить вручную в Telegram (Task 10).
- [ ] **Step 3: Commit** `CRM: доска, карточка заказа, скачивание PDF`

### Task 9: Перенос прошлых заказов

**Files:** Create `scripts/import-telegram-export.mjs`, `lib/crm/import.ts`, Test `lib/crm/import.test.ts`

**Interfaces:**
- Consumes: `fieldsFromCaption` (`lib/order-fields.ts`), `CrmOrder`.
- Produces: `parseExport(json: unknown, topics: { work: number; done: number }): Omit<CrmOrder, "commentsCount">[]` — сообщения бота с `#CODE`; апселл-сообщения «АПСЕЛЛ! Заявка #X» → `qty = 2` у заказа X; заметки `📝` в подписи → комментарии (`author_name: "из чата"`); стадия: `reply_to_message_id === done` → `done`, `=== work` → `production`, иначе (старая группа, отрицательный id) → `done`; `tgMessageId` — только для положительных id; `flags: ["imported"]`; `createdAt` — дата сообщения.

- [ ] **Step 1: Failing tests** на фрагменте реальной выгрузки (подписи `#YRQ5EQ`, `#LEFQ25`, `#S4R26G` + апселл `#MCF9HY`): стадии `production`/`done`/`done`, `qty` у `MCF9HY` = 2, у `YRQ5EQ` 2 комментария из `📝`, у `S4R26G` `tgMessageId === null`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Run import** — владелец заново прикладывает `result.json` (в репозиторий не коммитить). Скрипт пишет через `insertOrder`, пропуская существующие коды; итог: «добавлено N, пропущено M». Проверка: `select stage, count(*) from crm_orders where 'imported' = any(flags) group by stage` → 25 всего.
- [ ] **Step 6: Commit** `CRM: перенос заказов из выгрузки чата`

### Task 10: Настройка, README, выкатка

**Files:** Modify `README.md` (раздел «CRM»: что это, переменные, BotFather `/newapp` short name `crm` → `https://photobrelok.com/crm`, как узнать свой id через `/id` в личке бота, как скачать PDF, импорт), `.env.example`.

- [ ] **Step 1: Full check** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` → без ошибок.
- [ ] **Step 2: Owner setup** (владелец): переменные в Vercel (Production и Preview) — `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRM_ALLOWED_USER_IDS`, `TELEGRAM_BOT_USERNAME`; BotFather `/newapp`. Сервисный ключ в чат не присылать.
- [ ] **Step 3: Preview-проверка в Telegram** (владелец и компаньон): открыть CRM из кнопки под тестовым заказом, скачать PDF (≤ 2 нажатий), «Прислать в Telegram», сменить стадию, поправить доставку, комментарий; в чате подпись обновилась, сообщение на месте, PDF на месте; старая кнопка под ноябрьским заказом отвечает «Заказы теперь ведутся в CRM» и ничего не удаляет.
- [ ] **Step 4: Merge в `main`** только после Step 3, по команде владельца.
- [ ] **Step 5: Commit** `README: CRM — настройка и работа`
