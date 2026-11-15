// Ссылка на заказ в CRM (Mini App бота PHOTOBRELOK). В группах Telegram не даёт ставить кнопку web_app,
// поэтому кнопка — обычная ссылка на прямой адрес Mini App: t.me/<бот>/crm?startapp=<код>.

export type UrlButton = { text: string; url: string };

export function crmAppUrl(code: string, botUsername: string | undefined): string | null {
  const bot = (botUsername ?? "").trim().replace(/^@/, "");
  if (!bot) return null;
  return `https://t.me/${bot}/crm?startapp=${code}`;
}

export function crmKeyboardFor(code: string, botUsername: string | undefined): UrlButton[][] {
  const url = crmAppUrl(code, botUsername);
  return url ? [[{ text: "📋 Открыть в CRM", url }]] : [];
}

/** Кнопка под сообщением заказа. Пока CRM не настроена (нет TELEGRAM_BOT_USERNAME) — без кнопок. */
export function crmKeyboard(code: string): UrlButton[][] {
  return crmKeyboardFor(code, process.env.TELEGRAM_BOT_USERNAME);
}
