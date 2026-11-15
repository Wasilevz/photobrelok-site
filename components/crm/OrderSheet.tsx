"use client";

// Карточка заказа: каждое поле правится отдельно, стадия — крупной кнопкой, PDF — одним нажатием.
import { useCallback, useEffect, useState } from "react";
import {
  type CrmOrder,
  type OrderPatch,
  columnLabel,
  columnOf,
  nextStage,
  BASE_PRICE,
  URGENT_PRICE,
  orderBoxes,
  orderPrice,
  prevStage,
} from "@/lib/crm/model";
import { ApiError, type OrderDetails, api, patchOrder, webApp } from "./useCrmApi";
import { METHOD_LABEL, dateLabel, whenLabel } from "./format";
import DeliveryEditor from "./DeliveryEditor";
import { isPostMethod } from "@/lib/delivery-dates";
import PdfButtons from "./PdfButtons";

const input =
  "w-full min-h-[44px] rounded-lg border border-[#D9D0BF] bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-[#191715]";

const FIELD_NAME: Record<string, string> = {
  name: "имя", phone: "телефон", wantedDate: "дата", urgent: "срочно", method: "способ", postalCode: "индекс",
  city: "город", district: "район", street: "улица", branch: "отделение", address: "адрес", qty: "брелков", price: "цена",
  boxes: "коробки", extraCost: "доп. расходы", paid: "оплата",
};

function Row({ label, value, onEdit, children, editing }: {
  label: string;
  value: React.ReactNode;
  onEdit?: () => void;
  editing?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-[#E5DCCB] py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-[#5C564E]">{label}</div>
          {!editing && <div className="text-base break-words">{value}</div>}
        </div>
        {onEdit && !editing && (
          <button type="button" onClick={onEdit} aria-label={`Изменить: ${label}`} className="shrink-0 min-w-[44px] min-h-[44px] rounded-lg text-lg hover:bg-white">
            ✏️
          </button>
        )}
      </div>
      {editing && <div className="mt-2">{children}</div>}
    </div>
  );
}

function SaveCancel({ onSave, onCancel, saving }: { onSave: () => void; onCancel: () => void; saving: boolean }) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <button type="button" onClick={onCancel} className="min-h-[44px] rounded-xl border border-[#D9D0BF] bg-white text-sm">Отмена</button>
      <button type="button" onClick={onSave} disabled={saving} className="min-h-[44px] rounded-xl bg-[#191715] text-white text-sm font-semibold disabled:opacity-60">
        {saving ? "Сохраняем…" : "Сохранить"}
      </button>
    </div>
  );
}

export default function OrderSheet({
  code,
  onClose,
  onChanged,
  notify,
}: {
  code: string;
  onClose: () => void;
  onChanged: (order: CrmOrder) => void;
  notify: (text: string) => void;
}) {
  const [details, setDetails] = useState<OrderDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string | boolean>>({});
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetails(await api<OrderDetails>(`/api/crm/orders/${code}`));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось загрузить заказ");
    }
  }, [code]);

  useEffect(() => {
    void load();
  }, [load]);

  // Кнопка «Назад» Telegram закрывает карточку.
  useEffect(() => {
    const back = webApp()?.BackButton;
    if (!back) return;
    back.show();
    back.onClick(onClose);
    return () => {
      back.offClick(onClose);
      back.hide();
    };
  }, [onClose]);

  const save = async (patch: OrderPatch): Promise<boolean> => {
    setSaving(true);
    try {
      const { order, warnings } = await patchOrder(code, patch);
      onChanged(order);
      setEditing(null);
      await load();
      warnings.forEach(notify);
      webApp()?.HapticFeedback?.notificationOccurred?.("success");
      return true;
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Не сохранилось, попробуйте ещё раз");
      webApp()?.HapticFeedback?.notificationOccurred?.("error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (key: string, values: Record<string, string | boolean>) => {
    setDraft(values);
    setEditing(key);
  };

  const addComment = async () => {
    const text = comment.trim();
    if (!text) return;
    setSaving(true);
    try {
      const { comments } = await api<{ comments: OrderDetails["comments"] }>(`/api/crm/orders/${code}/comments`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setComment("");
      setDetails((d) => (d ? { ...d, comments, order: { ...d.order, commentsCount: comments.length } } : d));
      if (details) onChanged({ ...details.order, commentsCount: comments.length });
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Комментарий не сохранился");
    } finally {
      setSaving(false);
    }
  };

  const o = details?.order;
  const next = o ? nextStage(o.stage) : null;
  const prev = o ? prevStage(o.stage) : null;

  return (
    <div className="fixed inset-0 z-50 bg-[#F5F1E8] overflow-y-auto overscroll-contain" role="dialog" aria-modal="true" aria-label={`Заказ ${code}`}>
      <div className="mx-auto max-w-xl px-4 pb-28 pt-3">
        <div className="sticky top-0 z-10 -mx-4 mb-2 flex items-center gap-2 bg-[#F5F1E8] px-4 py-2">
          <button type="button" onClick={onClose} className="min-w-[44px] min-h-[44px] rounded-lg text-xl" aria-label="Закрыть">←</button>
          <div className="min-w-0">
            <div className="font-bold text-lg">#{code}</div>
            {o && <div className="text-xs text-[#5C564E]">{columnLabel(columnOf(o))} · пришёл {whenLabel(o.createdAt)}</div>}
          </div>
        </div>

        {error && <p className="rounded-xl bg-white p-4 text-[#B42318]">{error}</p>}
        {!o && !error && <p className="p-4 text-[#5C564E]">Загружаем…</p>}

        {o && (
          <>
            {o.urgent && (
              <div className="mb-3 rounded-xl border-2 border-[#B42318] bg-white px-3 py-2 font-semibold text-[#B42318]">⚡ Срочно · +100 лей</div>
            )}

            {o.paid ? (
              <div className="mb-3 rounded-xl border-2 border-[#067647] bg-[#ECFDF3] px-3 py-2 text-[#054F31]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-lg font-bold">💳 ОПЛАЧЕН на карту</div>
                    <div className="text-sm font-medium">
                      {isPostMethod(o.method) ? "Наложенный платёж НЕ оформлять — только изготовить и отправить." : "Деньги с клиента НЕ брать — только изготовить и отдать."}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => window.confirm("Снять отметку «оплачен»? Клиент будет платить при получении.") && void save({ paid: false })}
                    className="min-h-[40px] shrink-0 rounded-lg border border-[#067647]/40 bg-white px-2 text-xs text-[#3D3832]"
                  >
                    Снять
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={() => void save({ paid: true })}
                className="mb-3 min-h-[44px] w-full rounded-xl border border-dashed border-[#5C564E] bg-white/60 text-sm text-[#3D3832]"
              >
                💳 Клиент оплатил на карту — отметить
              </button>
            )}

            <PdfButtons code={o.code} hasPdf={!!o.pdfPath} />

            <div className="rounded-2xl bg-white/60 px-3">
              <Row label="👤 Имя" value={o.name} editing={editing === "name"} onEdit={() => startEdit("name", { name: o.name })}>
                <input className={input} value={String(draft.name ?? "")} onChange={(e) => setDraft({ name: e.target.value })} autoComplete="off" />
                <SaveCancel saving={saving} onCancel={() => setEditing(null)} onSave={() => save({ name: String(draft.name) })} />
              </Row>

              <Row
                label="📞 Телефон"
                value={<a className="underline underline-offset-2" href={`tel:${o.phone.replace(/\s/g, "")}`}>{o.phone}</a>}
                editing={editing === "phone"}
                onEdit={() => startEdit("phone", { phone: o.phone })}
              >
                <input className={input} type="tel" inputMode="tel" value={String(draft.phone ?? "")} onChange={(e) => setDraft({ phone: e.target.value })} autoComplete="off" />
                <SaveCancel saving={saving} onCancel={() => setEditing(null)} onSave={() => save({ phone: String(draft.phone) })} />
              </Row>

              <Row
                label="📅 Нужен к"
                value={<>{dateLabel(o.wantedDate)}{o.urgent ? " · ⚡ срочно" : ""}</>}
                editing={editing === "date"}
                onEdit={() => startEdit("date", { wantedDate: o.wantedDate ?? "", urgent: o.urgent })}
              >
                <input className={input} type="date" value={String(draft.wantedDate ?? "")} onChange={(e) => setDraft({ ...draft, wantedDate: e.target.value })} />
                {(o.method === "pickup" || o.method === "taxi") && (
                  <label className="mt-2 flex min-h-[44px] items-center gap-3 text-sm">
                    <input type="checkbox" className="size-5 accent-[#191715]" checked={draft.urgent === true} onChange={(e) => setDraft({ ...draft, urgent: e.target.checked })} />
                    ⚡ Срочно (+100 лей)
                  </label>
                )}
                <SaveCancel
                  saving={saving}
                  onCancel={() => setEditing(null)}
                  onSave={() => save({ wantedDate: draft.wantedDate ? String(draft.wantedDate) : null, urgent: draft.urgent === true })}
                />
              </Row>

              <Row
                label="🚚 Доставка"
                value={
                  <>
                    {METHOD_LABEL[o.method]}
                    {o.method === "posta" && (
                      <span className="block text-sm text-[#3D3832]">
                        {[o.postalCode && `MD-${o.postalCode.replace(/^MD-?/i, "")}`, o.city, o.district && `р-н ${o.district}`, o.street].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {o.method === "novapost" && <span className="block text-sm text-[#3D3832]">Отделение №{o.branch}</span>}
                    {o.method === "taxi" && <span className="block text-sm text-[#3D3832]">{o.address}</span>}
                  </>
                }
                editing={editing === "delivery"}
                onEdit={() => setEditing("delivery")}
              >
                <DeliveryEditor order={o} onSave={save} onCancel={() => setEditing(null)} />
              </Row>

              <Row
                label="🔑 Брелков"
                value={
                  <span className="flex items-center gap-3">
                    <button type="button" disabled={saving || o.qty <= 1} onClick={() => save({ qty: o.qty - 1 })} className="size-11 rounded-lg border border-[#D9D0BF] bg-white text-xl disabled:opacity-40" aria-label="Меньше брелков">−</button>
                    <span className="min-w-6 text-center text-lg font-semibold">{o.qty}</span>
                    <button type="button" disabled={saving || o.qty >= 20} onClick={() => save({ qty: o.qty + 1 })} className="size-11 rounded-lg border border-[#D9D0BF] bg-white text-xl disabled:opacity-40" aria-label="Больше брелков">+</button>
                  </span>
                }
              />

              <Row
                label="💰 Цена"
                value={<>{orderPrice(o)} лей{o.price === null ? <span className="text-xs text-[#5C564E]"> · авто</span> : null}</>}
                editing={editing === "price"}
                onEdit={() => startEdit("price", { price: o.price === null ? "" : String(o.price) })}
              >
                <input className={input} inputMode="numeric" placeholder={`авто: ${orderPrice({ ...o, price: null })}`} value={String(draft.price ?? "")} onChange={(e) => setDraft({ price: e.target.value.replace(/\D/g, "") })} />
                {o.qty > 1 && (
                  <button
                    type="button"
                    onClick={() => setDraft({ price: String(BASE_PRICE * o.qty + (o.urgent ? URGENT_PRICE : 0)) })}
                    className="mt-2 min-h-[44px] w-full rounded-lg border border-[#D9D0BF] bg-white text-sm"
                  >
                    Разные брелки, без скидки: {BASE_PRICE} × {o.qty}{o.urgent ? ` + ${URGENT_PRICE}` : ""} = {BASE_PRICE * o.qty + (o.urgent ? URGENT_PRICE : 0)} лей
                  </button>
                )}
                <p className="mt-1 text-xs text-[#5C564E]">Пусто — авто ({orderPrice({ ...o, price: null })} лей).</p>
                <SaveCancel saving={saving} onCancel={() => setEditing(null)} onSave={() => save({ price: draft.price ? Number(draft.price) : null })} />
              </Row>

              <Row
                label="🎁 Подарочных коробок"
                value={<>{orderBoxes(o).count}{orderBoxes(o).auto ? <span className="text-xs text-[#5C564E]"> · авто</span> : null}</>}
                editing={editing === "boxes"}
                onEdit={() => startEdit("boxes", { boxes: String(orderBoxes(o).count) })}
              >
                <input className={input} inputMode="numeric" value={String(draft.boxes ?? "")} onChange={(e) => setDraft({ boxes: e.target.value.replace(/\D/g, "") })} />
                <p className="mt-1 text-xs text-[#5C564E]">
                  Авто: 1 брелок — 1 коробка, 2 одинаковых — 1 на двоих, 3 и больше — каждому своя. Разные брелки или «каждый как подарок» — впишите число.
                </p>
                <SaveCancel saving={saving} onCancel={() => setEditing(null)} onSave={() => save({ boxes: Number(draft.boxes || 0) })} />
                {!orderBoxes(o).auto && (
                  <button type="button" disabled={saving} onClick={() => save({ boxes: null })} className="mt-2 min-h-[44px] w-full rounded-lg border border-[#D9D0BF] bg-white text-sm">
                    Вернуть авто ({o.qty === 2 ? 1 : o.qty})
                  </button>
                )}
              </Row>

              <Row
                label="🧾 Доп. расходы"
                value={o.extraCost ? `${o.extraCost} лей` : <span className="text-[#5C564E]">нет</span>}
                editing={editing === "extraCost"}
                onEdit={() => startEdit("extraCost", { extraCost: o.extraCost ? String(o.extraCost) : "" })}
              >
                <input className={input} inputMode="numeric" placeholder="0" value={String(draft.extraCost ?? "")} onChange={(e) => setDraft({ extraCost: e.target.value.replace(/\D/g, "") })} />
                <p className="mt-1 text-xs text-[#5C564E]">Расходы именно этого заказа сверх брелков и коробок (другой брелок, доставка за наш счёт…). Реклама — в Отчётах → Расходы.</p>
                <SaveCancel saving={saving} onCancel={() => setEditing(null)} onSave={() => save({ extraCost: draft.extraCost ? Number(draft.extraCost) : null })} />
              </Row>

              {o.lang === "ro" && <Row label="🌐 Язык" value="Клиент оформлял на румынском" />}
              {o.tgChatId !== null && o.tgMessageId !== null && String(o.tgChatId).startsWith("-100") && (
                <Row
                  label="💬 В чате"
                  value={
                    <button
                      type="button"
                      className="underline underline-offset-2"
                      onClick={() => webApp()?.openTelegramLink?.(`https://t.me/c/${String(o.tgChatId).slice(4)}/${o.tgMessageId}`)}
                    >
                      Открыть сообщение заказа
                    </button>
                  }
                />
              )}
            </div>

            <section className="mt-5">
              <h3 className="mb-2 font-semibold">💬 Комментарии</h3>
              {details.comments.length === 0 && <p className="text-sm text-[#5C564E]">Пока нет</p>}
              <ul className="flex flex-col gap-2">
                {details.comments.map((c, i) => (
                  <li key={i} className="rounded-xl bg-white px-3 py-2">
                    <div className="text-xs text-[#5C564E]">{c.authorName} · {whenLabel(c.createdAt)}</div>
                    <div className="whitespace-pre-wrap break-words text-sm">{c.text}</div>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <textarea
                  className={`${input} min-h-[44px] py-2`}
                  rows={2}
                  maxLength={1000}
                  placeholder="Добавить комментарий"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <button type="button" onClick={addComment} disabled={saving || !comment.trim()} className="shrink-0 rounded-xl bg-[#191715] px-4 text-sm font-semibold text-white disabled:opacity-40">
                  Добавить
                </button>
              </div>
            </section>

            <section className="mt-5">
              <button type="button" onClick={() => setShowHistory(!showHistory)} className="min-h-[44px] font-semibold">
                🕒 История {showHistory ? "▲" : "▼"}
              </button>
              {showHistory && (
                <ul className="flex flex-col gap-1 text-sm text-[#3D3832]">
                  {details.history.map((h, i) => (
                    <li key={i}>
                      <span className="text-[#5C564E]">{whenLabel(h.createdAt)} · {h.actorName}:</span>{" "}
                      {h.action === "stage"
                        ? `стадия → ${String((h.details as { to?: string }).to ?? "")}`
                        : h.action === "field"
                          ? `изменено: ${Object.keys(h.details).map((k) => FIELD_NAME[k] ?? k).join(", ")}`
                          : h.action === "created"
                            ? "заказ с сайта"
                            : h.action === "imported"
                              ? "перенесён из чата"
                              : h.action}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      {o && (next || prev) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#E5DCCB] bg-[#F5F1E8]/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-xl gap-2">
            {prev && (
              <button type="button" disabled={saving} onClick={() => save({ stage: prev })} className="min-h-[52px] rounded-xl border border-[#D9D0BF] bg-white px-4 text-sm disabled:opacity-60" aria-label="Вернуть на прошлую стадию">
                ← назад
              </button>
            )}
            {next && (
              <button type="button" disabled={saving} onClick={() => save({ stage: next })} className="min-h-[52px] flex-1 rounded-xl border-2 border-[#191715] bg-[#FFC400] px-3 font-bold disabled:opacity-60">
                → {columnLabel(columnOf({ stage: next, method: o.method }))}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
