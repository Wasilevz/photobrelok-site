// Заказ с сайта: если запись в CRM не удалась, заказ всё равно уходит в чат — с пометкой.
export function intakeCaption(caption: string, savedToCrm: boolean): string {
  return savedToCrm ? caption : `${caption}\n⚠️ Не записан в CRM`;
}
