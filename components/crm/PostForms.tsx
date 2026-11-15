"use client";

// Почтовые бланки Poșta Moldovei: кнопка печати (один заказ или все из колонки) и данные отправителя.
import { useEffect, useState } from "react";
import type { ParcelType, Sender } from "@/lib/crm/post-forms/data";
import { ApiError, api, saveFile } from "./useCrmApi";

const input = "min-h-[44px] w-full rounded-lg border border-[#D9D0BF] bg-white px-3 text-base";
const EMPTY: Sender = { name: "", street: "", locality: "", phone: "", payout: "address", idnp: "", iban: "", parcelType: "pachet", declareValue: true };
const TYPES: { id: ParcelType; label: string }[] = [
  { id: "scrisoare", label: "Scrisoare" },
  { id: "pachet", label: "Pachet mic" },
  { id: "colet", label: "Colet" },
];

export function SenderEditor({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [s, setS] = useState<Sender | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ sender: Sender | null }>("/api/crm/settings")
      .then((d) => setS(d.sender ?? EMPTY))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Не удалось загрузить"));
  }, []);

  const set = (patch: Partial<Sender>) => setS((cur) => (cur ? { ...cur, ...patch } : cur));
  const save = async () => {
    if (!s) return;
    setSaving(true);
    setError(null);
    try {
      await api("/api/crm/settings", { method: "PUT", body: JSON.stringify({ sender: s }) });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не сохранилось");
    } finally {
      setSaving(false);
    }
  };

  const field = (key: "name" | "street" | "locality" | "phone", label: string, placeholder: string) => (
    <label className="block text-xs text-[#5C564E]">
      {label}
      <input className={input} value={s?.[key] ?? ""} placeholder={placeholder} onChange={(e) => set({ [key]: e.target.value })} />
    </label>
  );

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-[#F5F1E8]" role="dialog" aria-modal="true" aria-label="Отправитель">
      <div className="mx-auto max-w-xl px-4 pb-16 pt-3">
        <div className="mb-2 flex items-center gap-2">
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] rounded-lg text-xl" aria-label="Закрыть">←</button>
          <div className="text-lg font-bold">✉️ Отправитель на бланках</div>
        </div>
        <p className="mb-3 text-sm text-[#5C564E]">Заполняется один раз — печатается на каждом бланке. Пишите латиницей, как в паспорте.</p>
        {!s && !error && <p className="text-[#5C564E]">Загружаем…</p>}
        {s && (
          <div className="flex flex-col gap-3 rounded-2xl bg-white p-3">
            {field("name", "Имя, фамилия (или название фирмы)", "Ion Scutaru")}
            {field("street", "Улица, дом, квартира", "bd. Dacia, 8, ap. 8")}
            {field("locality", "Индекс и город", "MD-2060, CHIȘINĂU")}
            {field("phone", "Телефон", "022 123 456")}

            <div>
              <div className="text-xs text-[#5C564E]">Вид отправления (галочка на бланке)</div>
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
              <div className="text-xs text-[#5C564E]">Деньги наложенного платежа (бланк TFP-3)</div>
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
            {error && <p className="text-sm text-[#B42318]">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={onClose} className="min-h-[48px] rounded-lg border border-[#D9D0BF] bg-white">Отмена</button>
              <button type="button" disabled={saving} onClick={save} className="min-h-[48px] rounded-lg border-2 border-[#191715] bg-[#FFC400] font-semibold disabled:opacity-60">
                {saving ? "Сохраняем…" : "Сохранить"}
              </button>
            </div>
          </div>
        )}
        {!s && error && <p className="rounded-xl bg-white p-4 text-[#B42318]">{error}</p>}
      </div>
    </div>
  );
}

/** Печать бланков для заказов. Нет данных отправителя — сначала откроет их, потом напечатает. */
export function PostFormsButton({ codes, label, className, notify }: { codes: string[]; label: string; className?: string; notify: (t: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [sender, setSender] = useState<"closed" | "required" | "edit">("closed");

  const print = async () => {
    setBusy(true);
    try {
      const { url, fileName } = await api<{ url: string; fileName: string }>("/api/crm/post-forms", { method: "POST", body: JSON.stringify({ codes }) });
      saveFile(url, fileName);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setSender("required");
      else notify(e instanceof ApiError ? e.message : "Не удалось подготовить бланки");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <button type="button" disabled={busy || codes.length === 0} onClick={print} className={className}>
          {busy ? "Готовим бланки…" : label}
        </button>
        <button type="button" onClick={() => setSender("edit")} aria-label="Данные отправителя" className="min-h-[44px] min-w-[44px] shrink-0 rounded-xl border border-[#D9D0BF] bg-white">
          ⚙️
        </button>
      </div>
      {sender !== "closed" && (
        <SenderEditor
          onClose={() => setSender("closed")}
          onSaved={() => {
            const retry = sender === "required";
            setSender("closed");
            if (retry) void print();
            else notify("Данные отправителя сохранены");
          }}
        />
      )}
    </>
  );
}
