// Телефон клиента: только Молдова, +373 и 8 цифр. Принимаем любой привычный вид записи.
// Модуль без локальных импортов (форма, API, тесты).

export type PhoneCheck =
  | { ok: true; digits: string }
  | { ok: false; reason: "empty" | "short" | "long" | "foreign"; count: number };

export function normalizeMdPhone(input: string): PhoneCheck {
  const raw = input.trim();
  let digits = raw.replace(/\D/g, "");
  if (!digits) return { ok: false, reason: "empty", count: 0 };

  const international = raw.startsWith("+") || raw.startsWith("00");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("373") && digits.length >= 11) digits = digits.slice(3);
  else if (international) return { ok: false, reason: "foreign", count: digits.length };
  else if (digits.length === 9 && digits.startsWith("0")) digits = digits.slice(1);

  if (digits.length < 8) return { ok: false, reason: "short", count: digits.length };
  if (digits.length > 8) return { ok: false, reason: "long", count: digits.length };
  return { ok: true, digits };
}

/** «+373 69 708 505». */
export function formatMdPhone(digits: string): string {
  return `+373 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
}
