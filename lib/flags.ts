// Флаг «Конструктор V2» (сохранение черновика, таймаут загрузки; обрезка ручная, как в обычном режиме).
// По умолчанию выключен. Включается переменной NEXT_PUBLIC_CONSTRUCTOR_V2=1 при сборке
// или адресом ?cv2=1 (запоминается на вкладку, ?cv2=0 выключает). Читать только в браузере.
const KEY = "photobrelok_cv2";

export function readConstructorV2(): boolean {
  if (process.env.NEXT_PUBLIC_CONSTRUCTOR_V2 === "1") return true;
  try {
    const q = new URLSearchParams(window.location.search).get("cv2");
    if (q === "1") window.sessionStorage.setItem(KEY, "1");
    if (q === "0") window.sessionStorage.removeItem(KEY);
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
