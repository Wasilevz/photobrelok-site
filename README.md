# PHOTOBRELOK — ретро-брелки с вашими фото

Готовый к деплою сайт: маркетинговый лендинг + пошаговый конструктор персонализации.

## Быстрый старт

```bash
cp .env.example .env.local   # ключи Telegram / Cloudinary (см. ниже)
npm install
npm run build
npm start
# http://localhost:3000  (или порт из вывода)
```

Dev: `npm run dev --webpack`

Тесты (даты, телефон, шаблон правки): `npm test`

## Что реализовано

### Конструктор (4 шага)
1. **Фото** — загрузка 5–10 снимков, drag&drop, счётчик, лимиты
2. **Кадры** — порядок (←/→), обрезка, удаление с подтверждением
3. **Макет** — live-preview плёнки и брелока, цена, срок, «оплата после макета»
4. **Заказ** — имя, телефон (+373 и 8 цифр), способ получения, **когда нужен брелок** (обязательно), второй брелок, согласия.
   Без автозаполнения браузера. Правила дат — `lib/delivery-dates.ts` (по времени Кишинёва):
   - самовывоз — с завтра; «⚡ Сегодня — срочно, +100 лей» до 18:00 (сервер принимает до 18:30), забрать самому или такси по Кишинёву за счёт клиента;
   - Poșta Moldovei / Nova Poshta — дата получения не раньше чем через 2 рабочих дня + 3 дня в пути, срочно нельзя.

### Telegram-сценарий (честный)
- **С настроенными ключами** — фото уходят на Cloudinary, заказ собирается в PDF и падает в Telegram менеджеру (`/api/order`)
- **Без ключей** — пользователь уходит в Telegram со сводкой и явной инструкцией: *«Если фото не прикрепились — отправьте их в чат отдельными сообщениями»*
- Сайт **не утверждает**, что фото отправлены, если этого не было

### UX / UI
- Тёплый фон `#F5F1E8`, акцент `#FFC400`, текст `#191715`
- Rubik — интерфейс, Caveat — только короткие акценты
- Mobile-first: 320–1440 px без горизонтальной прокрутки
- Состояния кнопок, focus-visible, `prefers-reduced-motion`
- Нижняя CTA скрывается в конструкторе
- Уход со страницы при несохранённых фото — предупреждение

### Аналитика
`lib/analytics.ts` → `window.dataLayer` (если подключён). События: hero_view, hero_cta, builder_start, photos_uploaded, photos_edited, preview_view, checkout_start, telegram_click, order_submit, order_api_success. PII в аналитику не уходит.

## CRM заказов (Mini App в Telegram)

Все заказы с сайта попадают в Supabase и в CRM — раздел сайта `/crm`, который открывается внутри Telegram
кнопкой **📋 Открыть в CRM** под сообщением заказа (бот PHOTOBRELOK).

- **Доска:** 🆕 Новые → 🛠 В производстве → 🏪 Готов к выдаче (самовывоз, такси) / 📦 Готов к отправке (почта) → ✅ Завершён.
  На телефоне — вкладки со счётчиками, на компьютере — колонки с перетаскиванием. Колонку «Готов» выбирает способ доставки.
- **Карточка заказа:** каждое поле правится отдельно (✏️), доставка — способ кнопками, потом только нужные поля;
  количество брелков, цена (авто: 250 + 150 за каждый следующий + 100 за срочность), комментарии, история изменений.
- **PDF:** «⬇️ Скачать PDF» — родное окно сохранения Telegram; «📩 Прислать в Telegram» — бот пришлёт PDF в личку
  (сначала один раз откройте бота и нажмите Start). Иконка ⬇️ есть и прямо в списке.
- **Чат:** заказы по-прежнему приходят в тему «В работе» с PDF. **Бот ничего не удаляет и не переносит** — только
  обновляет подпись (поля и `📌 Стадия`). Старые кнопки под прошлыми заказами отвечают «Заказы теперь ведутся в CRM».
  Запрет на удаления сторожит тест `lib/no-deletes.test.ts`.

### Настройка (один раз)
1. **Vercel → Settings → Environment Variables** (Production и Preview):
   - `SUPABASE_URL` = `https://uvuavmzrxtyvsytzjywk.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Project Settings → API Keys → service_role/secret. **Секрет: только в Vercel, не в чат.**
   - `TELEGRAM_BOT_USERNAME` — имя бота без `@`
   - `CRM_ALLOWED_USER_IDS` — Telegram id через запятую (узнать свой: написать боту `/id` в личке)
2. **BotFather** → `/newapp` → выбрать бота PHOTOBRELOK → short name `crm` → URL `https://photobrelok.com/crm`.
3. Redeploy в Vercel, чтобы переменные подхватились.

База: таблицы `crm_orders`, `crm_comments`, `crm_history` и приватный бакет `order-pdfs` (миграции в `supabase/migrations`).

Локально без Telegram: `CRM_DEV_USER_ID=<id из CRM_ALLOWED_USER_IDS> npm run dev` (в production не работает).

## Флаги (по умолчанию выключены, production работает как раньше)

| Флаг | Что включает | Как включить |
|---|---|---|
| `NEXT_PUBLIC_LAYOUT=v2` | Новый макет главной (`components/LandingV2.tsx`, 7 секций) вместо прежнего `Landing.tsx` | Переменная при сборке, либо адрес `?layout=v2` (на вкладку; `?layout=v1` возвращает прежний) |
| `NEXT_PUBLIC_CONSTRUCTOR_V2=1` | Конструктор V2: сохранение фото на устройстве (переживают обновление страницы) и таймаут загрузки; обрезка ручная, как раньше | Переменная при сборке, либо адрес `?cv2=1` (на вкладку; `?cv2=0` выключает) |

Адрес с `?layout=…` показывает прежнюю страницу на долю секунды до переключения; при включении переменной при сборке этого нет.
Откат: убрать переменную и пересобрать (или `git revert`).

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Токен бота |
| `TELEGRAM_CHAT_ID` | Куда падают заказы (можно несколько через запятую) |
| `TELEGRAM_TOPIC_WORK/PICKUP/SHIP/DONE` | ID тем-стадий (см. выше) |
| `TELEGRAM_WEBHOOK_SECRET` | Секрет вебхука бота |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Загрузка фото |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Unsigned preset |
| `SUPABASE_URL` | CRM: адрес проекта Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | CRM: секретный ключ Supabase (только сервер, sensitive) |
| `TELEGRAM_BOT_USERNAME` | CRM: имя бота без @ (кнопка «Открыть в CRM») |
| `CRM_ALLOWED_USER_IDS` | CRM: Telegram id, кому открыт доступ |

Без них сайт работает, заказ идёт через Telegram-ссылку с инструкцией.

## Деплой (Vercel)

1. Залейте папку в GitHub  
2. Import на vercel.com  
3. Environment Variables из `.env.example`  
4. Deploy  

## Контакты (не менять без подтверждения)

- Telegram: https://t.me/+37378238455  
- Телефон: 078 238 455  
- Адрес: ул. Alexander Bernardazzi, 64, Кишинёв  
- Почта: fotobrelokmd@gmail.com  

Контакты в `lib/contacts.ts`.

## Структура

```
components/Landing.tsx        # секции лендинга
components/PhotoConstructor.tsx # пошаговый конструктор
components/LandingV2.tsx      # новый макет главной (за флагом)
components/ImageCropper.tsx   # обрезка (react-easy-crop)
public/landing.css            # дизайн-система
app/api/order/                # PDF + Telegram (сервер)
app/api/telegram-webhook/     # бот: /id и ответы старым кнопкам
app/crm/, components/crm/      # CRM (Mini App)
app/api/crm/                  # API CRM
lib/crm/                      # вход, модель заказа, подпись в чате, Supabase, импорт
lib/telegram-orders.ts        # подпись заказа, второй брелок
lib/telegram-bot.ts           # обработка апдейтов бота
lib/analytics.ts              # события воронки
```
