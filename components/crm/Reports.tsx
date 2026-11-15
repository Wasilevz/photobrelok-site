"use client";

// Отчёты: заказы, брелки и суммы за период + по дням и по способам доставки.
import { useEffect, useState } from "react";
import type { Costs } from "@/lib/crm/model";
import type { Period, Report } from "@/lib/crm/reports";
import { ApiError, api } from "./useCrmApi";
import { METHOD_LABEL, dateLabel } from "./format";

const PERIODS: { id: Period; label: string }[] = [
  { id: "today", label: "Сегодня" },
  { id: "7d", label: "7 дней" },
  { id: "month", label: "Этот месяц" },
  { id: "prev_month", label: "Прошлый месяц" },
  { id: "custom", label: "Свои даты" },
];

const num = new Intl.NumberFormat("ru-RU");
const lei = (n: number) => `${num.format(n)} лей`;

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-3">
      <div className="text-xs text-[#5C564E]">{label}</div>
      <div className="mt-0.5 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

const COST_FIELDS: { key: keyof Costs; label: string }[] = [
  { key: "keychain", label: "🔑 Брелок" },
  { key: "boxSingle", label: "📦 Обычная коробка" },
  { key: "boxDouble", label: "🎁 Подарочная (на 2)" },
];

/** Себестоимость единиц: от неё считается чистая прибыль. */
function CostsEditor({ costs, onSaved }: { costs: Costs; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<keyof Costs, string>>({ keychain: "", boxSingle: "", boxDouble: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const empty = !costs.keychain && !costs.boxSingle && !costs.boxDouble;

  const start = () => {
    setDraft({ keychain: String(costs.keychain || ""), boxSingle: String(costs.boxSingle || ""), boxDouble: String(costs.boxDouble || "") });
    setError(null);
    setEditing(true);
  };
  const save = async () => {
    setSaving(true);
    try {
      const next = Object.fromEntries(COST_FIELDS.map((f) => [f.key, Number(draft[f.key].replace(",", ".")) || 0])) as Costs;
      await api("/api/crm/settings", { method: "PUT", body: JSON.stringify({ costs: next }) });
      setEditing(false);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не сохранилось");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`mt-2 rounded-2xl p-3 text-sm ${empty && !editing ? "border-2 border-[#B42318] bg-white" : "bg-white"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold">Себестоимость</div>
        {!editing && (
          <button type="button" onClick={start} className="min-h-[40px] rounded-lg px-2 text-lg" aria-label="Изменить себестоимость">✏️</button>
        )}
      </div>
      {!editing && empty && <p className="text-[#B42318]">Укажите цену брелка и коробок — без неё прибыль равна выручке.</p>}
      {!editing && !empty && (
        <p className="text-[#3D3832]">{COST_FIELDS.map((f) => `${f.label} ${num.format(costs[f.key])}`).join(" · ")} лей</p>
      )}
      {editing && (
        <div className="mt-1 flex flex-col gap-2">
          {COST_FIELDS.map((f) => (
            <label key={f.key} className="flex items-center justify-between gap-3">
              <span>{f.label}</span>
              <input
                inputMode="decimal"
                placeholder="0"
                value={draft[f.key]}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value.replace(/[^\d.,]/g, "") }))}
                className="min-h-[44px] w-28 rounded-lg border border-[#D9D0BF] bg-white px-3 text-right text-base"
              />
            </label>
          ))}
          <p className="text-xs text-[#5C564E]">Лей за штуку. Пересчитает прибыль во всех отчётах, в том числе за прошлые периоды.</p>
          {error && <p className="text-[#B42318]">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setEditing(false)} className="min-h-[44px] rounded-lg border border-[#D9D0BF] bg-white">Отмена</button>
            <button type="button" disabled={saving} onClick={save} className="min-h-[44px] rounded-lg border-2 border-[#191715] bg-[#FFC400] font-semibold disabled:opacity-60">
              {saving ? "Сохраняем…" : "Сохранить"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Reports({ onClose }: { onClose: () => void }) {
  const [period, setPeriod] = useState<Period>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState<{ key: string; report?: Report; error?: string } | null>(null);
  const [version, setVersion] = useState(0); // +1 → перезапросить (после смены себестоимости)
  const [report, setReport] = useState<Report | null>(null); // последний удачный — виден, пока грузится новый

  const base = period === "custom" ? (from && to ? new URLSearchParams({ period, from, to }).toString() : null) : `period=${period}`;
  const key = base && `${base}&v=${version}`;
  const loading = key !== null && result?.key !== key;
  const error = result?.key === key ? (result?.error ?? null) : null;

  useEffect(() => {
    if (!key) return;
    let alive = true;
    api<{ report: Report }>(`/api/crm/reports?${key}`)
      .then((d) => {
        if (!alive) return;
        setResult({ key, report: d.report });
        setReport(d.report);
      })
      .catch((e) => alive && setResult({ key, error: e instanceof ApiError ? e.message : "Не удалось загрузить отчёт" }));
    return () => {
      alive = false;
    };
  }, [key]);

  const days = report ? [...report.days].reverse() : [];
  const maxRevenue = Math.max(1, ...days.map((d) => d.revenue));
  const input = "min-h-[44px] w-full rounded-lg border border-[#D9D0BF] bg-white px-3 text-base";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-[#F5F1E8]" role="dialog" aria-modal="true" aria-label="Отчёты">
      <div className="mx-auto max-w-xl px-4 pb-16 pt-3">
        <div className="sticky top-0 z-10 -mx-4 mb-2 flex items-center gap-2 bg-[#F5F1E8] px-4 py-2">
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] rounded-lg text-xl" aria-label="Закрыть">←</button>
          <div className="text-lg font-bold">📊 Отчёты</div>
        </div>

        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2" role="tablist">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={period === p.id}
              onClick={() => setPeriod(p.id)}
              className={`min-h-[40px] shrink-0 rounded-full border-2 px-3 text-sm font-medium ${
                period === p.id ? "border-[#191715] bg-[#FFC400]" : "border-[#D9D0BF] bg-white"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="mb-3 grid grid-cols-2 gap-2">
            <label className="text-xs text-[#5C564E]">
              С
              <input type="date" className={input} value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="text-xs text-[#5C564E]">
              По
              <input type="date" className={input} value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
        )}

        {error && <p className="rounded-xl bg-white p-4 text-[#B42318]">{error}</p>}
        {period === "custom" && (!from || !to) && <p className="p-2 text-sm text-[#5C564E]">Выберите обе даты.</p>}
        {loading && !report && <p className="p-4 text-[#5C564E]">Считаем…</p>}

        {report && !error && (
          <div className={loading ? "opacity-60" : ""}>
            <p className="mb-2 text-sm text-[#5C564E]">
              {report.from === report.to ? dateLabel(report.from) : `${dateLabel(report.from)} — ${dateLabel(report.to)}`}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Tile label="Заказов" value={num.format(report.orders)} />
              <Tile label="Брелков" value={num.format(report.keychains)} />
              <Tile label="Сумма" value={lei(report.revenue)} />
              <Tile label="Средний чек" value={lei(report.avgCheck)} />
              <Tile label="Себестоимость" value={lei(report.cost)} />
              <div className="rounded-2xl border-2 border-[#191715] bg-[#FFC400] p-3">
                <div className="text-xs">Чистая прибыль</div>
                <div className="mt-0.5 text-2xl font-bold tabular-nums">{lei(report.profit)}</div>
              </div>
            </div>
            <CostsEditor costs={report.costs} onSaved={() => setVersion((v) => v + 1)} />
            <div className="mt-2 rounded-2xl bg-white p-3 text-sm">
              <div>✅ Завершено: <b>{report.done.orders}</b> заказов · {report.done.keychains} брелков · {lei(report.done.revenue)} · прибыль <b>{lei(report.done.profit)}</b></div>
              <div className="mt-1">🎁 Коробок: <b>{report.boxesSingle}</b> обычных · <b>{report.boxesDouble}</b> подарочных</div>
              <div className="mt-1">⚡ Срочных: <b>{report.urgent}</b></div>
              <div className="mt-1 text-xs text-[#5C564E]">
                Сумма — по ценам заказов (авто или вручную). Прибыль = сумма − брелки − коробки − доп. расходы заказов. Дата — день, когда пришёл заказ.
              </div>
            </div>

            {report.methods.length > 0 && (
              <>
                <h2 className="mb-2 mt-5 font-semibold">По способу доставки</h2>
                <ul className="rounded-2xl bg-white px-3">
                  {report.methods.map((m) => (
                    <li key={m.method} className="border-b border-[#E5DCCB] py-2.5 text-sm last:border-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span>{METHOD_LABEL[m.method]}</span>
                        <b className="tabular-nums">{lei(m.revenue)}</b>
                      </div>
                      <div className="text-xs text-[#5C564E] tabular-nums">{m.orders} зак. · {m.keychains} бр. · прибыль {lei(m.profit)}</div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {days.length > 1 && (
              <>
                <h2 className="mb-2 mt-5 font-semibold">По дням</h2>
                <ul className="rounded-2xl bg-white px-3">
                  {days.map((d) => (
                    <li key={d.day} className={`border-b border-[#E5DCCB] py-2 text-sm last:border-0 ${d.orders === 0 ? "text-[#8A8379]" : ""}`}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span>{dateLabel(d.day)}</span>
                        <span className="tabular-nums">{d.orders ? <b>{lei(d.revenue)}</b> : "—"}</span>
                      </div>
                      {d.orders > 0 && (
                        <div className="text-xs text-[#5C564E] tabular-nums">{d.orders} зак. · {d.keychains} бр. · прибыль {lei(d.profit)}</div>
                      )}
                      {d.revenue > 0 && (
                        <div className="mt-1 h-1.5 rounded-full bg-[#F0EADC]">
                          <div className="h-1.5 rounded-full bg-[#FFC400]" style={{ width: `${(d.revenue / maxRevenue) * 100}%` }} />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
