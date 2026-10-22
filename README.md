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

## Что реализовано

### Конструктор (4 шага)
1. **Фото** — загрузка 5–10 снимков, drag&drop, счётчик, лимиты
2. **Кадры** — порядок (←/→), обрезка, удаление с подтверждением
3. **Макет** — live-preview плёнки и брелока, цена, срок, «оплата после макета»
4. **Заказ** — имя, телефон, повод/дата (необязательно), доставка, сводка

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

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Токен бота |
| `TELEGRAM_CHAT_ID` | Куда падают заказы (можно несколько через запятую) |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Загрузка фото |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Unsigned preset |

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
components/Constructor.tsx    # пошаговый конструктор
components/ImageCropper.tsx   # обрезка (react-easy-crop)
public/landing.css            # дизайн-система
app/api/order/                # PDF + Telegram (сервер)
lib/analytics.ts              # события воронки
```
