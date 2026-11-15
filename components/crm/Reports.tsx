"use client";

// Отчёты: заказы, брелки и суммы за период + по дням и по способам доставки.
import { useEffect, useState } from "react";
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

export default function Reports({ onClose }: { onClose: () => void }) {
  const [period, setPeriod] = useState<Period>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState<{ key: string; report?: Report; error?: string } | null>(null);
  const [report, setReport] = useState<Report | null>(null); // последний удачный — виден, пока грузится новый

  const key = period === "custom" ? (from && to ? new URLSearchParams({ period, from, to }).toString() : null) : `period=${period}`;
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
            </div>
            <div className="mt-2 rounded-2xl bg-white p-3 text-sm">
              <div>✅ Завершено: <b>{report.done.orders}</b> заказов · {report.done.keychains} брелков · <b>{lei(report.done.revenue)}</b></div>
              <div className="mt-1">⚡ Срочных: <b>{report.urgent}</b></div>
              <div className="mt-1 text-xs text-[#5C564E]">Сумма — по ценам заказов (авто или вручную). Дата — день, когда пришёл заказ.</div>
            </div>

            {report.methods.length > 0 && (
              <>
                <h2 className="mb-2 mt-5 font-semibold">По способу доставки</h2>
                <ul className="rounded-2xl bg-white px-3">
                  {report.methods.map((m) => (
                    <li key={m.method} className="flex items-baseline justify-between gap-2 border-b border-[#E5DCCB] py-2.5 text-sm last:border-0">
                      <span>{METHOD_LABEL[m.method]}</span>
                      <span className="tabular-nums text-right">{m.orders} зак. · {m.keychains} бр. · <b>{lei(m.revenue)}</b></span>
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
                        <span className="tabular-nums">
                          {d.orders ? <>{d.orders} зак. · {d.keychains} бр. · <b>{lei(d.revenue)}</b></> : "—"}
                        </span>
                      </div>
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
