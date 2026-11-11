export const TELEGRAM_URL = "https://t.me/+37378238455";
export const TELEGRAM_PHONE = "+37378238455";
export const TELEGRAM_PHONE_DISPLAY = "078 238 455";
export const EMAIL = "fotobrelokmd@gmail.com";

export const INSTAGRAM_URL = "https://www.instagram.com/photobrelok.md/";
/** Личные сообщения Instagram (Direct). Ник подтверждён владельцем: photobrelok.md */
export const INSTAGRAM_DM_URL = "https://ig.me/m/photobrelok.md";

export function telegramLink(text: string) {
  return `${TELEGRAM_URL}?text=${encodeURIComponent(text)}`;
}
