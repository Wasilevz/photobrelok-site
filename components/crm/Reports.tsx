"use client";

// Отчёты: что пришло за период (по дню заказа) и чистая прибыль по завершённым (по дню завершения)
// минус расходы бизнеса за период. Себестоимость и расходы правятся здесь же.
import { useEffect, useState } from "react";
import type { Costs } from "@/lib/crm/model";
import type { Expense } from "@/lib/crm/expenses";
import type { Period, Report } from "@/lib/crm/reports";
import { ApiError, api, webApp } from "./useCrmApi";
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
const inputCls = "min-h-[44px] w-full rounded-lg border border-[#D9D0BF] bg-white px-3 text-base";
const btn = "min-h-[44px] rounded-lg border border-[#D9D0BF] bg-white";
const btnMain = "min-h-[44px] rounded-lg border-2 border-[#191715] bg-[#FFC400] font-semibold disabled:opacity-60";

function todayChisinau(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Chisinau" }).format(new Date());
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-3">
      <div className="text-xs text-[#5C564E]">{label}</div>
      <div className="mt-0.5 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Line({ label, value, minus, strong }: { label: React.ReactNode; value: number; minus?: boolean; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1 ${strong ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{minus && value ? "− " : ""}{lei(value)}</span>
    </div>
  );
}

/** Себестоимость единиц: брелок и подарочная коробка. */
function CostsEditor({ costs, onSaved }: { costs: Costs; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ keychain: "", box: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const empty = !costs.keychain && !costs.box;

  const save = async () => {
    setSaving(true);
    try {
      const next: Costs = { keychain: Number(draft.keychain.replace(",", ".")) || 0, box: Number(draft.box.replace(",", ".")) || 0 };
      await api("/api/crm/settings", { method: "PUT", body: JSON.stringify({ costs: next }) });
      setEditing(false);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не сохранилось");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className={`flex items-center justify-between gap-2 rounded-xl p-3 text-sm ${empty ? "border-2 border-[#B42318] bg-white" : "bg-[#F5F1E8]"}`}>
        <span className={empty ? "text-[#B42318]" : ""}>
          {empty ? "Укажите цену брелка и коробки — иначе прибыль завышена" : `Себестоимость: брелок ${num.format(costs.keychain)} · коробка ${num.format(costs.box)} лей`}
        </span>
        <button
          type="button"
          onClick={() => {
            setDraft({ keychain: String(costs.keychain || ""), box: String(costs.box || "") });
            setError(null);
            setEditing(true);
          }}
          className="min-h-[40px] min-w-[40px] rounded-lg text-lg"
          aria-label="Изменить себестоимость"
        >
          ✏️
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-[#F5F1E8] p-3 text-sm">
      {([["keychain", "🔑 Брелок (лей за штуку)"], ["box", "🎁 Подарочная коробка"]] as const).map(([k, label]) => (
        <label key={k} className="flex items-center justify-between gap-3">
          <span>{label}</span>
          <input
            inputMode="decimal"
            placeholder="0"
            value={draft[k]}
            onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value.replace(/[^\d.,]/g, "") }))}
            className="min-h-[44px] w-28 rounded-lg border border-[#D9D0BF] bg-white px-3 text-right text-base"
          />
        </label>
      ))}
      <p className="text-xs text-[#5C564E]">Пересчитает прибыль во всех периодах, в том числе прошлых.</p>
      {error && <p className="text-[#B42318]">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setEditing(false)} className={btn}>Отмена</button>
        <button type="button" disabled={saving} onClick={save} className={btnMain}>{saving ? "Сохраняем…" : "Сохранить"}</button>
      </div>
    </div>
  );
}

/** Форма расхода: новая запись или правка существующей. */
function ExpenseForm({ initial, onDone, onCancel }: { initial?: Expense; onDone: () => void; onCancel: () => void }) {
  const [day, setDay] = useState(initial?.day ?? todayChisinau());
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = JSON.stringify({ day, amount: Number(amount || 0), note });
      if (initial) await api(`/api/crm/expenses/${initial.id}`, { method: "PATCH", body });
      else await api("/api/crm/expenses", { method: "POST", body });
      webApp()?.HapticFeedback?.notificationOccurred?.("success");
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не сохранилось");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-[#F5F1E8] p-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-[#5C564E]">
          Дата
          <input type="date" className={inputCls} value={day} onChange={(e) => setDay(e.target.value)} />
        </label>
        <label className="text-xs text-[#5C564E]">
          Сумма, лей
          <input inputMode="numeric" className={inputCls} placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
        </label>
      </div>
      <label className="text-xs text-[#5C564E]">
        На что
        <input className={inputCls} placeholder="Реклама Instagram" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {initial && <p className="text-xs text-[#5C564E]">Ошибочный расход — поставьте сумму 0.</p>}
      {error && <p className="text-[#B42318]">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className={btn}>Отмена</button>
        <button type="button" disabled={saving || !amount} onClick={save} className={btnMain}>{saving ? "Сохраняем…" : "Сохранить"}</button>
      </div>
    </div>
  );
}

/** Служебное: проставить кнопки стадий под незавершёнными заказами в чате (после перехода на чат по стадиям). */
function RefreshChatButtons() {
  const [state, setState] = useState<"idle" | "busy" | string>("idle");
  const run = async () => {
    setState("busy");
    try {
      const { updated } = await api<{ updated: number }>("/api/crm/chat/refresh", { method: "POST" });
      setState(`Готово: обновлено заказов — ${updated}`);
    } catch (e) {
      setState(e instanceof ApiError ? e.message : "Не получилось, попробуйте ещё раз");
    }
  };
  return (
    <section className="mt-6 rounded-2xl bg-white p-3 text-sm">
      <h2 className="font-semibold">🔄 Кнопки в чате</h2>
      <p className="mb-2 text-xs text-[#5C564E]">Поставить кнопки стадий («В производство», «Готов», «Завершить») под всеми незавершёнными заказами в чате. Нужно один раз; займёт до минуты.</p>
      <button type="button" disabled={state === "busy"} onClick={() => void run()} className={`${btn} w-full font-semibold disabled:opacity-60`}>
        {state === "busy" ? "Обновляем…" : "Обновить кнопки в чате"}
      </button>
      {state !== "idle" && state !== "busy" && <p className="mt-2">{state}</p>}
    </section>
  );
}

export default function Reports({ onClose }: { onClose: () => void }) {
  const [period, setPeriod] = useState<Period>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [version, setVersion] = useState(0); // +1 → перезапросить после правки себестоимости или расходов
  const [result, setResult] = useState<{ key: string; error?: string } | null>(null);
  const [data, setData] = useState<{ report: Report; expenses: Expense[] } | null>(null); // последний удачный
  const [expenseForm, setExpenseForm] = useState<"new" | string | null>(null);

  const base = period === "custom" ? (from && to ? new URLSearchParams({ period, from, to }).toString() : null) : `period=${period}`;
  const key = base && `${base}&v=${version}`;
  const loading = key !== null && result?.key !== key;
  const error = result?.key === key ? (result?.error ?? null) : null;
  const refresh = () => setVersion((v) => v + 1);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    api<{ report: Report; expenses: Expense[] }>(`/api/crm/reports?${key}`)
      .then((d) => {
        if (!alive) return;
        setResult({ key });
        setData(d);
      })
      .catch((e) => alive && setResult({ key, error: e instanceof ApiError ? e.message : "Не удалось загрузить отчёт" }));
    return () => {
      alive = false;
    };
  }, [key]);

  const report = data?.report;
  const days = report ? [...report.days].reverse() : [];
  const maxRevenue = Math.max(1, ...days.map((d) => d.revenue));
  const done = report?.done;

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
              <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="text-xs text-[#5C564E]">
              По
              <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
        )}

        {error && <p className="rounded-xl bg-white p-4 text-[#B42318]">{error}</p>}
        {period === "custom" && (!from || !to) && <p className="p-2 text-sm text-[#5C564E]">Выберите обе даты.</p>}
        {loading && !report && <p className="p-4 text-[#5C564E]">Считаем…</p>}

        {report && done && !error && (
          <div className={loading ? "opacity-60" : ""}>
            <p className="mb-3 text-sm text-[#5C564E]">
              {report.from === report.to ? dateLabel(report.from) : `${dateLabel(report.from)} — ${dateLabel(report.to)}`}
            </p>

            {/* Чистая прибыль */}
            <section className="rounded-2xl bg-white p-3">
              <h2 className="font-semibold">💰 Чистая прибыль</h2>
              <p className="mb-2 text-xs text-[#5C564E]">Только завершённые заказы — по дню, когда заказ завершили.</p>
              <div className="rounded-xl border-2 border-[#191715] bg-[#FFC400] p-3">
                <div className="text-3xl font-bold tabular-nums">{lei(done.profit)}</div>
                <div className="text-sm">
                  завершено {done.orders} зак. · {done.keychains} брелков · коробок {done.boxes}
                </div>
              </div>
              <div className="mt-2 text-sm">
                <Line label="Выручка" value={done.revenue} />
                <Line label={`Брелки (${done.keychains} шт.)`} value={done.keychainCost} minus />
                <Line label={`Коробки (${done.boxes} шт.)`} value={done.boxCost} minus />
                {done.extraCost > 0 && <Line label="Доп. расходы заказов" value={done.extraCost} minus />}
                <Line label="Расходы (реклама и др.)" value={done.expenses} minus />
                <div className="mt-1 border-t border-[#E5DCCB] pt-1">
                  <Line label="Чистая прибыль" value={done.profit} strong />
                </div>
              </div>
              <div className="mt-2">
                <CostsEditor costs={report.costs} onSaved={refresh} />
              </div>
            </section>

            {/* Расходы бизнеса */}
            <section className="mt-3 rounded-2xl bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">🧾 Расходы · {lei(done.expenses)}</h2>
                {expenseForm === null && (
                  <button type="button" onClick={() => setExpenseForm("new")} className={`${btnMain} px-3 text-sm`}>+ Добавить</button>
                )}
              </div>
              <p className="mb-2 text-xs text-[#5C564E]">Реклама и всё, что не относится к одному заказу.</p>
              {expenseForm === "new" && <ExpenseForm onCancel={() => setExpenseForm(null)} onDone={() => { setExpenseForm(null); refresh(); }} />}
              {data.expenses.length === 0 && expenseForm !== "new" && <p className="py-2 text-sm text-[#5C564E]">За период расходов нет.</p>}
              <ul>
                {data.expenses.map((e) =>
                  expenseForm === e.id ? (
                    <li key={e.id} className="py-2">
                      <ExpenseForm initial={e} onCancel={() => setExpenseForm(null)} onDone={() => { setExpenseForm(null); refresh(); }} />
                    </li>
                  ) : (
                    <li key={e.id} className="flex items-center justify-between gap-2 border-b border-[#E5DCCB] py-2 text-sm last:border-0">
                      <div className="min-w-0">
                        <div className="truncate">{e.note || "Без описания"}</div>
                        <div className="text-xs text-[#5C564E]">{dateLabel(e.day)}{e.createdBy ? ` · ${e.createdBy}` : ""}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <b className={`tabular-nums ${e.amount === 0 ? "text-[#8A8379] line-through" : ""}`}>{lei(e.amount)}</b>
                        <button type="button" onClick={() => setExpenseForm(e.id)} className="min-h-[40px] min-w-[40px] rounded-lg" aria-label="Изменить расход">✏️</button>
                      </div>
                    </li>
                  ),
                )}
              </ul>
            </section>

            {/* Что пришло */}
            <h2 className="mb-2 mt-5 font-semibold">📥 Пришло заказов за период</h2>
            <div className="grid grid-cols-2 gap-2">
              <Tile label="Заказов" value={num.format(report.orders)} />
              <Tile label="Брелков" value={num.format(report.keychains)} />
              <Tile label="Сумма" value={lei(report.revenue)} />
              <Tile label="Средний чек" value={lei(report.avgCheck)} />
            </div>
            {report.urgent > 0 && <p className="mt-2 text-sm">⚡ Срочных: <b>{report.urgent}</b></p>}

            {report.methods.length > 0 && (
              <>
                <h2 className="mb-2 mt-5 font-semibold">По способу получения</h2>
                <ul className="rounded-2xl bg-white px-3">
                  {report.methods.map((m) => (
                    <li key={m.method} className="border-b border-[#E5DCCB] py-2.5 text-sm last:border-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span>{METHOD_LABEL[m.method]}</span>
                        <b className="tabular-nums">{lei(m.revenue)}</b>
                      </div>
                      <div className="text-xs tabular-nums text-[#5C564E]">{m.orders} зак. · {m.keychains} бр.</div>
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
                      {d.orders > 0 && <div className="text-xs tabular-nums text-[#5C564E]">{d.orders} зак. · {d.keychains} бр.</div>}
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
        <RefreshChatButtons />
      </div>
    </div>
  );
}
