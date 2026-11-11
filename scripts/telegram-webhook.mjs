// Подключает бота к сайту: node scripts/telegram-webhook.mjs https://ваш-домен
// Нужны переменные окружения TELEGRAM_BOT_TOKEN и TELEGRAM_WEBHOOK_SECRET.
const [, , siteUrl] = process.argv;
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!siteUrl || !token || !secret) {
  console.error("Использование: TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... node scripts/telegram-webhook.mjs https://ваш-домен");
  process.exit(1);
}

const url = `${siteUrl.replace(/\/$/, "")}/api/telegram-webhook`;
const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  }),
});
const json = await res.json();
console.log(json.ok ? `Вебхук установлен: ${url}` : `Ошибка: ${json.description}`);
process.exit(json.ok ? 0 : 1);
