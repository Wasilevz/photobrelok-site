"use client";

// Доставка: сначала способ кнопками, потом только поля этого способа (как в форме на сайте).
import { useState } from "react";
import type { DeliveryMethod } from "@/lib/order-fields";
import type { CrmOrder, OrderPatch } from "@/lib/crm/model";
import { MD_DISTRICTS } from "@/lib/md-districts";
import { METHOD_LABEL } from "./format";

const METHODS: DeliveryMethod[] = ["pickup", "posta", "novapost", "taxi", "later"];

const input =
  "w-full min-h-[44px] rounded-lg border border-[#D9D0BF] bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-[#191715]";

export default function DeliveryEditor({
  order,
  onSave,
  onCancel,
}: {
  order: CrmOrder;
  onSave: (patch: OrderPatch) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [method, setMethod] = useState<DeliveryMethod>(order.method);
  const [postalCode, setPostalCode] = useState(order.postalCode ?? "");
  const [city, setCity] = useState(order.city ?? "");
  const [district, setDistrict] = useState(order.district ?? "");
  const [street, setStreet] = useState(order.street ?? "");
  const [branch, setBranch] = useState(order.branch ?? "");
  const [address, setAddress] = useState(order.address ?? "");
  const [saving, setSaving] = useState(false);

  // Старый район не из списка (введён вручную до списка) — оставляем его вариантом выбора.
  const districtOptions = MD_DISTRICTS.map((d) => d.ru);
  if (district && !districtOptions.includes(district) && !MD_DISTRICTS.some((d) => d.ro === district)) districtOptions.unshift(district);

  const save = async () => {
    setSaving(true);
    const patch: OrderPatch = { method };
    if (method === "posta") Object.assign(patch, { postalCode, city, district, street });
    if (method === "novapost") patch.branch = branch;
    if (method === "taxi") patch.address = address;
    if (method !== "pickup" && method !== "taxi" && order.urgent) patch.urgent = false;
    const done = await onSave(patch);
    setSaving(false);
    if (done) onCancel();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {METHODS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            aria-pressed={method === m}
            className={`min-h-[44px] rounded-xl border-2 px-2 text-sm font-medium ${
              method === m ? "border-[#191715] bg-[#FFC400]/40" : "border-[#D9D0BF] bg-white"
            } ${m === "later" ? "col-span-2" : ""}`}
          >
            {METHOD_LABEL[m]}
          </button>
        ))}
      </div>

      {method === "posta" && (
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
          <label className="text-xs text-[#5C564E]">
            Индекс
            <input className={input} inputMode="numeric" maxLength={6} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} autoComplete="off" />
          </label>
          <label className="text-xs text-[#5C564E]">
            Район
            <select className={input} value={district} onChange={(e) => setDistrict(e.target.value)}>
              <option value="">— выберите —</option>
              {districtOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-[#5C564E] col-span-2">
            Город / село
            <input className={input} value={city} onChange={(e) => setCity(e.target.value)} autoComplete="off" />
          </label>
          <label className="text-xs text-[#5C564E] col-span-2">
            Улица, дом (необязательно)
            <input className={input} value={street} onChange={(e) => setStreet(e.target.value)} autoComplete="off" />
          </label>
        </div>
      )}
      {method === "novapost" && (
        <label className="text-xs text-[#5C564E]">
          Номер отделения
          <input className={input} inputMode="numeric" value={branch} onChange={(e) => setBranch(e.target.value)} autoComplete="off" />
        </label>
      )}
      {method === "taxi" && (
        <label className="text-xs text-[#5C564E]">
          Адрес по Кишинёву
          <input className={input} value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="off" />
        </label>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className="min-h-[44px] rounded-xl border border-[#D9D0BF] bg-white text-sm">
          Отмена
        </button>
        <button type="button" onClick={save} disabled={saving} className="min-h-[44px] rounded-xl bg-[#191715] text-white text-sm font-semibold disabled:opacity-60">
          {saving ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
