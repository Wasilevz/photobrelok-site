"use client";

// Печать на готовые бланки Poșta Moldovei: кнопки печати, отправитель, размеры бланков и сдвиг принтера.
import { useEffect, useState } from "react";
import { type BlankKind, type BlankPrint, DEFAULT_PRINT, type ParcelType, type PrintSettings, type Sender } from "@/lib/crm/post-forms/data";
import { ApiError, api, saveFile } from "./useCrmApi";

const input = "min-h-[44px] w-full rounded-lg border border-[#D9D0BF] bg-white px-3 text-base";
const EMPTY: Sender = { name: "", street: "", locality: "", phone: "", payout: "address", idnp: "", iban: "", parcelType: "pachet", declareValue: true };
const TYPES: { id: ParcelType; label: string }[] = [
  { id: "scrisoare", label: "Scrisoare" },
  { id: "pachet", label: "Pachet mic" },
  { id: "colet", label: "Colet" },
];
const KIND_LABEL: Record<BlankKind, string> = { ramburs: "Бланк отправления", tfp3: "TFP-3 (перевод денег)" };

async function printForms(codes: string[], kind: BlankKind, test = false): Promise<void> {
  const { url, fileName } = await api<{ url: string; fileName: string }>("/api/crm/post-forms", {
    method: "POST",
    body: JSON.stringify({ codes, kind, test }),
  });
  saveFile(url, fileName);
}

type Draft = Record<BlankKind, Record<keyof BlankPrint, string>>;
const toDraft = (p: PrintSettings): Draft =>
  Object.fromEntries((["ramburs", "tfp3"] as const).map((k) => [k, Object.fromEntries(Object.entries(p[k]).map(([f, v]) => [f, String(v)]))])) as Draft;

/** Настройки печати: отправитель, размеры бланков, сдвиг и пробная печать. */
export function PostSettings({ onClose, onSaved, notify }: { onClose: () => void; onSaved: () => void; notify: (t: string) => void }) {
  const [s, setS] = useState<Sender | null>(null);
  const [print, setPrint] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ sender: Sender | null; print: PrintSettings }>("/api/crm/settings")
      .then((d) => {
        setS(d.sender ?? EMPTY);
        setPrint(toDraft(d.print ?? DEFAULT_PRINT));
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Не удалось загрузить"));
  }, []);

  const set = (patch: Partial<Sender>) => setS((cur) => (cur ? { ...cur, ...patch } : cur));
  const setP = (k: BlankKind, f: keyof BlankPrint, v: string) =>
    setPrint((cur) => (cur ? { ...cur, [k]: { ...cur[k], [f]: v.replace(/[^\d.,-]/g, "") } } : cur));

  const savePrint = async () => {
    if (!print) return;
    await api("/api/crm/settings", { method: "PUT", body: JSON.stringify({ print }) });
  };
  const save = async () => {
    if (!s) return;
    setSaving(true);
    setError(null);
    try {
      await savePrint();
      await api("/api/crm/settings", { method: "PUT", body: JSON.stringify({ sender: s }) });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не сохранилось");
    } finally {
      setSaving(false);
    }
  };
  const testPrint = async (k: BlankKind) => {
    try {
      await savePrint(); // пробный лист — с размерами, которые сейчас на экране
      await printForms([], k, true);
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Не удалось подготовить пробный лист");
    }
  };

  const field = (key: "name" | "street" | "locality" | "phone", label: string, placeholder: string) => (
    <label className="block text-xs text-[#5C564E]">
      {label}
      <input className={input} value={s?.[key] ?? ""} placeholder={placeholder} onChange={(e) => set({ [key]: e.target.value })} />
    </label>
  );
  const mm = (k: BlankKind, f: keyof BlankPrint, label: string) => (
    <label className="block text-xs text-[#5C564E]">
      {label}
      <input className={`${input} text-right`} inputMode="decimal" value={print?.[k][f] ?? ""} onChange={(e) => setP(k, f, e.target.value)} />
    </label>
  );

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-[#F5F1E8]" role="dialog" aria-modal="true" aria-label="Печать бланков">
      <div className="mx-auto max-w-xl px-4 pb-16 pt-3">
        <div className="mb-2 flex items-center gap-2">
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] rounded-lg text-xl" aria-label="Закрыть">←</button>
          <div className="text-lg font-bold">🖨 Печать на бланки почты</div>
        </div>
        {!s && !error && <p className="text-[#5C564E]">Загружаем…</p>}
        {!s && error && <p className="rounded-xl bg-white p-4 text-[#B42318]">{error}</p>}
        {s && print && (
          <div className="flex flex-col gap-3">
            <section className="flex flex-col gap-3 rounded-2xl bg-white p-3">
              <h2 className="font-semibold">✉️ Отправитель</h2>
              <p className="-mt-2 text-xs text-[#5C564E]">Печатается на каждом бланке. Пишите латиницей, как в паспорте.</p>
              {field("name", "Имя, фамилия (или название фирмы)", "Ion Scutaru")}
              {field("street", "Улица, дом, квартира", "bd. Dacia, 8, ap. 8")}
              {field("locality", "Индекс и город", "MD-2060, CHIȘINĂU")}
              {field("phone", "Телефон", "022 123 456")}
              <div>
                <div className="text-xs text-[#5C564E]">Вид отправления (крестик на бланке)</div>
                <div className="mt-1 grid grid-cols-3 gap-1.5">
                  {TYPES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => set({ parcelType: t.id })}
                      className={`min-h-[44px] rounded-lg border-2 text-sm ${s.parcelType === t.id ? "border-[#191715] bg-[#FFC400] font-semibold" : "border-[#D9D0BF] bg-white"}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex min-h-[44px] items-center gap-2 text-sm">
                <input type="checkbox" className="size-5 accent-[#191715]" checked={s.declareValue} onChange={(e) => set({ declareValue: e.target.checked })} />
                Объявленная ценность = сумме наложенного платежа
              </label>
              <div>
                <div className="text-xs text-[#5C564E]">Деньги наложенного платежа (TFP-3)</div>
                <div className="mt-1 grid grid-cols-2 gap-1.5">
                  {([["address", "Наличными на почте"], ["card", "На карту (IBAN)"]] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => set({ payout: id })}
                      className={`min-h-[44px] rounded-lg border-2 text-sm ${s.payout === id ? "border-[#191715] bg-[#FFC400] font-semibold" : "border-[#D9D0BF] bg-white"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {s.payout === "card" && (
                <>
                  <label className="block text-xs text-[#5C564E]">
                    IDNP (13 цифр)
                    <input className={input} inputMode="numeric" value={s.idnp} onChange={(e) => set({ idnp: e.target.value.replace(/\D/g, "").slice(0, 13) })} />
                  </label>
                  <label className="block text-xs text-[#5C564E]">
                    IBAN карты
                    <input className={input} value={s.iban} placeholder="MD…" onChange={(e) => set({ iban: e.target.value.toUpperCase() })} />
                  </label>
                </>
              )}
            </section>

            {(["ramburs", "tfp3"] as const).map((k) => (
              <section key={k} className="flex flex-col gap-2 rounded-2xl bg-white p-3">
                <h2 className="font-semibold">📐 {KIND_LABEL[k]}, мм</h2>
                <div className="grid grid-cols-2 gap-2">
                  {mm(k, "w", "Ширина бланка")}
                  {mm(k, "h", "Высота бланка")}
                  {mm(k, "dx", "Сдвиг вправо (− влево)")}
                  {mm(k, "dy", "Сдвиг вниз (− вверх)")}
                </div>
                <button type="button" onClick={() => void testPrint(k)} className="min-h-[44px] rounded-lg border-2 border-[#191715] bg-white text-sm font-semibold">
                  🧪 Пробная печать — {k === "ramburs" ? "бланк отправления" : "TFP-3"}
                </button>
              </section>
            ))}

            <details className="rounded-2xl bg-white p-3 text-sm">
              <summary className="cursor-pointer font-semibold">Как настроить один раз</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-[#3D3832]">
                <li>Измерьте линейкой бланк (ширина × высота) и впишите выше.</li>
                <li>«Пробная печать» → печатайте на обычный лист, вставив его в принтер так же, как будете вставлять бланк. В настройках печати: «Фактический размер / 100%», не «По размеру страницы».</li>
                <li>Положите пробный лист на настоящий бланк, совместите края и посмотрите на просвет: текст должен стоять в полях.</li>
                <li>Уехал вправо на 2 мм — впишите сдвиг вправо −2; ниже на 1 мм — сдвиг вниз −1. Повторите пробу.</li>
              </ol>
            </details>

            {error && <p className="text-sm text-[#B42318]">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={onClose} className="min-h-[48px] rounded-lg border border-[#D9D0BF] bg-white">Отмена</button>
              <button type="button" disabled={saving} onClick={save} className="min-h-[48px] rounded-lg border-2 border-[#191715] bg-[#FFC400] font-semibold disabled:opacity-60">
                {saving ? "Сохраняем…" : "Сохранить"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Кнопки печати на бланки: «Бланк отправления» для всех заказов, «TFP-3» — для неоплаченных (наложенный платёж).
 * Нет данных отправителя — сначала откроет настройки, потом напечатает.
 */
export function PostFormsButtons({
  codes,
  codCodes,
  notify,
  countInLabel,
  primary,
}: {
  codes: string[];
  codCodes: string[];
  notify: (t: string) => void;
  countInLabel?: boolean;
  primary?: boolean;
}) {
  const [busy, setBusy] = useState<BlankKind | null>(null);
  const [settings, setSettings] = useState<{ retry?: BlankKind } | null>(null);

  const run = async (kind: BlankKind) => {
    setBusy(kind);
    try {
      await printForms(kind === "tfp3" ? codCodes : codes, kind);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setSettings({ retry: kind });
      else notify(e instanceof ApiError ? e.message : "Не удалось подготовить бланки");
    } finally {
      setBusy(null);
    }
  };

  const cls = `min-h-[44px] flex-1 rounded-xl border-2 border-[#191715] px-2 text-sm font-semibold active:scale-[0.98] disabled:opacity-60 ${primary ? "bg-[#FFC400]" : "bg-white"}`;
  const n = (list: string[]) => (countInLabel ? ` (${list.length})` : "");

  return (
    <>
      <div className="flex gap-2">
        <button type="button" disabled={busy !== null || codes.length === 0} onClick={() => void run("ramburs")} className={cls}>
          {busy === "ramburs" ? "Готовим…" : `🖨 Отправление${n(codes)}`}
        </button>
        {codCodes.length > 0 && (
          <button type="button" disabled={busy !== null} onClick={() => void run("tfp3")} className={cls}>
            {busy === "tfp3" ? "Готовим…" : `🖨 TFP-3${n(codCodes)}`}
          </button>
        )}
        <button type="button" onClick={() => setSettings({})} aria-label="Настройки печати на бланки" className="min-h-[44px] min-w-[44px] shrink-0 rounded-xl border border-[#D9D0BF] bg-white">
          ⚙️
        </button>
      </div>
      {settings && (
        <PostSettings
          notify={notify}
          onClose={() => setSettings(null)}
          onSaved={() => {
            const retry = settings.retry;
            setSettings(null);
            if (retry) void run(retry);
            else notify("Настройки печати сохранены");
          }}
        />
      )}
    </>
  );
}
