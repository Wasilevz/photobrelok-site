// Флаг нового макета главной (LandingV2). По умолчанию выключен: на production остаётся прежний Landing.
// Включается переменной NEXT_PUBLIC_LAYOUT=v2 при сборке или адресом ?layout=v2 (запоминается на вкладку).
// ?layout=v1 возвращает прежний макет. Читать только в браузере.
const KEY = "photobrelok_layout";

export function readLayoutV2(): boolean {
  const envV2 = process.env.NEXT_PUBLIC_LAYOUT === "v2";
  try {
    const q = new URLSearchParams(window.location.search).get("layout");
    if (q === "v2" || q === "v1") window.sessionStorage.setItem(KEY, q);
    const stored = window.sessionStorage.getItem(KEY);
    if (stored === "v2") return true;
    if (stored === "v1") return false;
  } catch {
    // sessionStorage недоступен: используем значение по умолчанию
  }
  return envV2;
}
