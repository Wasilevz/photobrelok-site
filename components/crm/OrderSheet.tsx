"use client";

// Карточка заказа: разделы «Файлы», «Оплата», «Получение», «Клиент», «Заказ». Каждое поле правится отдельно,
// стадия — крупной кнопкой внизу. Открывается сразу из списка; комментарии и история догружаются.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type CrmOrder,
  type OrderPatch,
  BASE_PRICE,
  POST_DELIVERY_FEE,
  URGENT_PRICE,
  amountDue,
  columnLabel,
  columnOf,
  moneyState,
  nextStage,
  orderBoxes,
  orderPrice,
  prevStage,
} from "@/lib/crm/model";
import { stepLabel } from "@/lib/crm/chat";
import { isPostMethod } from "@/lib/delivery-dates";
import { ApiError, type OrderDetails, api, confirmDialog, openTelegram, patchOrder, webApp } from "./useCrmApi";
import { METHOD_LABEL, chatMessageUrl, dateLabel, whenLabel } from "./format";
import DeliveryEditor from "./DeliveryEditor";
import PdfButtons from "./PdfButtons";
import { PostFormsButtons } from "./PostForms";
import { btnPlain, btnPrimary, card } from "./ui";

const input =
  "w-full min-h-[44px] rounded-lg border border-[#D9D0BF] bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-[#191715]";

const FIELD_NAME: Record<string, string> = {
  name: "имя", phone: "телефон", wantedDate: "дата", urgent: "срочно", method: "способ получения", postalCode: "индекс",
  city: "город", district: "район", street: "улица", branch: "отделение", address: "адрес", qty: "брелков", price: "цена",
  boxes: "коробки", extraCost: "доп. расходы", paid: "оплата", moneyAt: "деньги получены", returnedAt: "возврат",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-[#8A8275]">{title}</h3>
      <div className={`${card} divide-y divide-[#F0EADD] px-3`}>{children}</div>
    </section>
  );
}

function Row({ label, value, onEdit, children, editing }: {
  label: string;
  value: React.ReactNode;
  onEdit?: () => void;
  editing?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-[#8A8275]">{label}</div>
          {!editing && <div className="break-words text-base">{value}</div>}
        </div>
        {onEdit && !editing && (
          <button type="button" onClick={onEdit} aria-label={`Изменить: ${label}`} className="min-h-[44px] shrink-0 rounded-lg px-2 text-sm font-medium text-[#5C564E] underline underline-offset-2">
            Изменить
          </button>
        )}
      </div>
      {editing && <div className="mt-2 pb-1">{children}</div>}
    </div>
  );
}

function SaveCancel({ onSave, onCancel, saving }: { onSave: () => void; onCancel: () => void; saving: boolean }) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <button type="button" onClick={onCancel} className={btnPlain}>Отмена</button>
      <button type="button" onClick={onSave} disabled={saving} className="min-h-[44px] rounded-xl bg-[#191715] text-sm font-semibold text-white disabled:opacity-60">
        {saving ? "Сохраняем…" : "Сохранить"}
      </button>
    </div>
  );
}

/** Одно место про деньги: предоплата на карту, оплата при получении, деньги с почты, возврат. */
function Payment({ o, saving, save }: { o: CrmOrder; saving: boolean; save: (patch: OrderPatch) => void }) {
  const state = moneyState(o);
  const post = isPostMethod(o.method);
  const small = "min-h-[40px] shrink-0 rounded-lg border border-[#D9D0BF] bg-white px-3 text-sm";
  if (o.paid) {
    return (
      <div className="my-2.5 rounded-xl border-2 border-[#067647] bg-[#ECFDF3] px-3 py-2 text-[#054F31]">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-lg font-bold">💳 ОПЛАЧЕН на карту</div>
            <div className="text-sm font-medium">{post ? "Наложенный платёж НЕ оформлять — только изготовить и отправить." : "Деньги с клиента НЕ брать — только изготовить и отдать."}</div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={async () => (await confirmDialog("Снять отметку «оплачен»? Клиент будет платить при получении.")) && save({ paid: false })}
            className={small}
          >
            Снять
          </button>
        </div>
      </div>
    );
  }
  if (state === "pending") {
    return (
      <div className="my-2.5 rounded-xl border-2 border-dashed border-[#B54708] bg-[#FFFAEB] px-3 py-2">
        <div className="font-semibold">⏳ Ждём деньги с почты · {amountDue(o)} лей</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" disabled={saving} onClick={() => save({ money: "received" })} className="min-h-[44px] rounded-lg border-2 border-[#067647] bg-white text-sm font-semibold">
            💰 Деньги получены
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={async () => (await confirmDialog("Отметить возврат: клиент не забрал посылку? Заказ уйдёт в отчёт как убыток.")) && save({ money: "returned" })}
            className="min-h-[44px] rounded-lg border border-[#B42318]/50 bg-white text-sm text-[#B42318]"
          >
            ↩️ Не забрали
          </button>
        </div>
      </div>
    );
  }
  if (state === "received") {
    return (
      <div className="my-2.5 flex items-center justify-between gap-2 rounded-xl border-2 border-[#067647] bg-[#ECFDF3] px-3 py-2">
        <span className="font-semibold text-[#054F31]">💰 Деньги получены {o.moneyAt ? whenLabel(o.moneyAt) : ""}</span>
        {post && (
          <button type="button" disabled={saving} onClick={() => save({ money: "pending" })} className={small}>
            Отменить
          </button>
        )}
      </div>
    );
  }
  if (state === "returned") {
    return (
      <div className="my-2.5 flex items-center justify-between gap-2 rounded-xl border-2 border-[#B42318] bg-[#FEF3F2] px-3 py-2">
        <span className="font-semibold text-[#B42318]">↩️ Не забрали — возврат</span>
        <button type="button" disabled={saving} onClick={() => save({ money: "received" })} className={small}>
          💰 Всё же получены
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-2 py-2.5">
      <div>
        <div className="text-xs text-[#8A8275]">Клиент платит при получении</div>
        <div className="text-base font-semibold">{amountDue(o)} лей</div>
      </div>
      <button type="button" disabled={saving} onClick={() => save({ paid: true })} className={small}>
        💳 Оплатил на карту
      </button>
    </div>
  );
}

export default function OrderSheet({
  code,
  initial,
  onClose,
  onChanged,
  onDeleted,
  notify,
}: {
  code: string;
  /** Заказ из уже загруженного списка — карточка открывается сразу, без ожидания сети. */
  initial?: CrmOrder;
  onClose: () => void;
  onChanged: (order: CrmOrder) => void;
  onDeleted: (code: string) => void;
  notify: (text: string) => void;
}) {
  const [details, setDetails] = useState<OrderDetails | null>(() => (initial ? { order: initial, comments: [], history: [] } : null));
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string | boolean>>({});
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const data = await api<OrderDetails>(`/api/crm/orders/${code}`);
      if (mine !== seq.current) return; // пока грузили, заказ уже сохранили — ответ устарел
      setDetails(data);
      setLoaded(true);
      setError(null);
    } catch (e) {
      if (mine === seq.current) setError(e instanceof ApiError ? e.message : "Не удалось загрузить заказ");
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
    seq.current++; // идущая загрузка карточки устарела
    try {
      const { order, warnings } = await patchOrder(code, patch);
      onChanged(order);
      setDetails((d) => (d ? { ...d, order } : { order, comments: [], history: [] }));
      setEditing(null);
      warnings.forEach(notify);
      webApp()?.HapticFeedback?.notificationOccurred?.("success");
      void load(); // история — в фоне, карточка уже обновлена
      return true;
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Не сохранилось, попробуйте ещё раз");
      webApp()?.HapticFeedback?.notificationOccurred?.("error");
      void load();
      return false;
    } finally {
      setSaving(false);
    }
  };

  const askHideOrder = async () => {
    const o = details?.order;
    if (!o) return;
    const ok = await confirmDialog(
      `Удалить заказ #${o.code} (${o.name}) полностью?\n\nБудут стёрты сообщение в чате, PDF, комментарии и история. Вернуть будет нельзя.`,
    );
    if (!ok) return;
    setSaving(true);
    try {
      const { chat } = await api<{ chat: "deleted" | "none" | "failed" }>(`/api/crm/orders/${o.code}/trash`, {
        method: "POST",
        body: JSON.stringify({ confirm: o.code }),
      });
      webApp()?.HapticFeedback?.notificationOccurred?.("success");
      onDeleted(o.code);
      if (chat === "failed") notify("Заказ удалён, но сообщение в чате Telegram не дал удалить (старше 48 часов) — удалите его вручную");
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Не удалось удалить, попробуйте ещё раз");
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
  const chatUrl = o ? chatMessageUrl(o) : null;

  return (
    <div className="fixed inset-0 z-50 lg:bg-[#191715]/40" role="dialog" aria-modal="true" aria-label={`Заказ ${code}`} onClick={onClose}>
      {/* Телефон — на весь экран; компьютер — панель справа, доска остаётся видна. */}
      <div className="ml-auto flex h-full w-full flex-col bg-[#F5F1E8] lg:max-w-[600px] lg:shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-[#E5DCCB] px-2 py-2">
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] rounded-lg text-xl" aria-label="Закрыть">←</button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold leading-tight">{o ? o.name : `#${code}`}</div>
            {o && (
              <div className="truncate text-xs text-[#5C564E]">
                <span className="font-mono">#{code}</span> · {columnLabel(columnOf(o))} · пришёл {whenLabel(o.createdAt)}
              </div>
            )}
          </div>
          {o && (
            <a href={`tel:${o.phone.replace(/\s/g, "")}`} aria-label={`Позвонить ${o.phone}`} className={`${btnPlain} flex shrink-0 items-center`}>
              📞<span className="ml-1 hidden sm:inline">{o.phone}</span>
            </a>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8">
          {error && <p className="mt-3 rounded-xl bg-white p-4 text-[#B42318]">{error}</p>}
          {!o && !error && <p className="p-4 text-[#5C564E]">Загружаем…</p>}

          {o && (
            <>
              {o.urgent && <div className="mt-3 rounded-xl bg-[#B42318] px-3 py-2 font-semibold text-white">⚡ Срочно · +{URGENT_PRICE} лей</div>}

              <Section title="Файлы">
                <div className="flex flex-col gap-2 py-3">
                  <PdfButtons code={o.code} hasPdf={!!o.pdfPath} chatUrl={chatUrl} />
                  {o.method === "posta" && <PostFormsButtons codes={[o.code]} codCodes={o.paid ? [] : [o.code]} notify={notify} />}
                  {!o.pdfPath && !chatUrl && o.method !== "posta" && <p className="text-sm text-[#8A8275]">У этого заказа нет PDF</p>}
                </div>
              </Section>

              <Section title="Оплата">
                <Payment o={o} saving={saving} save={(patch) => void save(patch)} />
                <Row
                  label="Цена заказа"
                  value={
                    <>
                      {orderPrice(o)} лей{o.price === null ? <span className="text-xs text-[#8A8275]"> · авто</span> : null}
                      {o.method === "posta" && (
                        <span className="block text-sm text-[#5C564E]">+ {POST_DELIVERY_FEE} доставка почтой = {amountDue(o)} лей</span>
                      )}
                    </>
                  }
                  editing={editing === "price"}
                  onEdit={() => startEdit("price", { price: o.price === null ? "" : String(o.price) })}
                >
                  <input className={input} inputMode="numeric" placeholder={`авто: ${orderPrice({ ...o, price: null })}`} value={String(draft.price ?? "")} onChange={(e) => setDraft({ price: e.target.value.replace(/\D/g, "") })} />
                  {o.qty > 1 && (
                    <button
                      type="button"
                      onClick={() => setDraft({ price: String(BASE_PRICE * o.qty + (o.urgent ? URGENT_PRICE : 0)) })}
                      className={`${btnPlain} mt-2 w-full`}
                    >
                      Разные брелки, без скидки: {BASE_PRICE} × {o.qty}{o.urgent ? ` + ${URGENT_PRICE}` : ""} = {BASE_PRICE * o.qty + (o.urgent ? URGENT_PRICE : 0)} лей
                    </button>
                  )}
                  <p className="mt-1 text-xs text-[#8A8275]">Пусто — авто ({orderPrice({ ...o, price: null })} лей).</p>
                  <SaveCancel saving={saving} onCancel={() => setEditing(null)} onSave={() => save({ price: draft.price ? Number(draft.price) : null })} />
                </Row>
              </Section>

              <Section title="Получение">
                <Row
                  label="Нужен к"
                  value={<>{dateLabel(o.wantedDate)}{o.urgent ? " · ⚡ срочно" : ""}</>}
                  editing={editing === "date"}
                  onEdit={() => startEdit("date", { wantedDate: o.wantedDate ?? "", urgent: o.urgent })}
                >
                  <input className={input} type="date" value={String(draft.wantedDate ?? "")} onChange={(e) => setDraft({ ...draft, wantedDate: e.target.value })} />
                  {(o.method === "pickup" || o.method === "taxi") && (
                    <label className="mt-2 flex min-h-[44px] items-center gap-3 text-sm">
                      <input type="checkbox" className="size-5 accent-[#191715]" checked={draft.urgent === true} onChange={(e) => setDraft({ ...draft, urgent: e.target.checked })} />
                      ⚡ Срочно (+{URGENT_PRICE} лей)
                    </label>
                  )}
                  <SaveCancel
                    saving={saving}
                    onCancel={() => setEditing(null)}
                    onSave={() => save({ wantedDate: draft.wantedDate ? String(draft.wantedDate) : null, urgent: draft.urgent === true })}
                  />
                </Row>

                <Row
                  label="Способ получения"
                  value={
                    <>
                      {METHOD_LABEL[o.method]}
                      {o.method === "posta" && (
                        <span className="block text-sm text-[#5C564E]">
                          {[o.postalCode && `MD-${o.postalCode.replace(/^MD-?/i, "")}`, o.city, o.district && `р-н ${o.district}`, o.street].filter(Boolean).join(", ")}
                        </span>
                      )}
                      {o.method === "novapost" && <span className="block text-sm text-[#5C564E]">Отделение №{o.branch}</span>}
                      {o.method === "taxi" && <span className="block text-sm text-[#5C564E]">{o.address}</span>}
                    </>
                  }
                  editing={editing === "delivery"}
                  onEdit={() => setEditing("delivery")}
                >
                  <DeliveryEditor order={o} onSave={save} onCancel={() => setEditing(null)} />
                </Row>
              </Section>

              <Section title="Клиент">
                <Row label="Имя" value={o.name} editing={editing === "name"} onEdit={() => startEdit("name", { name: o.name })}>
                  <input className={input} value={String(draft.name ?? "")} onChange={(e) => setDraft({ name: e.target.value })} autoComplete="off" />
                  <SaveCancel saving={saving} onCancel={() => setEditing(null)} onSave={() => save({ name: String(draft.name) })} />
                </Row>
                <Row
                  label="Телефон"
                  value={<a className="underline underline-offset-2" href={`tel:${o.phone.replace(/\s/g, "")}`}>{o.phone}</a>}
                  editing={editing === "phone"}
                  onEdit={() => startEdit("phone", { phone: o.phone })}
                >
                  <input className={input} type="tel" inputMode="tel" value={String(draft.phone ?? "")} onChange={(e) => setDraft({ phone: e.target.value })} autoComplete="off" />
                  <SaveCancel saving={saving} onCancel={() => setEditing(null)} onSave={() => save({ phone: String(draft.phone) })} />
                </Row>
                {o.lang === "ro" && <Row label="Язык" value="Клиент оформлял на румынском" />}
              </Section>

              <Section title="Заказ">
                <Row
                  label="Брелков"
                  value={
                    <span className="flex items-center gap-3">
                      <button type="button" disabled={saving || o.qty <= 1} onClick={() => save({ qty: o.qty - 1 })} className="size-11 rounded-lg border border-[#D9D0BF] bg-white text-xl disabled:opacity-40" aria-label="Меньше брелков">−</button>
                      <span className="min-w-6 text-center text-lg font-semibold">{o.qty}</span>
                      <button type="button" disabled={saving || o.qty >= 20} onClick={() => save({ qty: o.qty + 1 })} className="size-11 rounded-lg border border-[#D9D0BF] bg-white text-xl disabled:opacity-40" aria-label="Больше брелков">+</button>
                    </span>
                  }
                />

                <Row
                  label="Подарочных коробок"
                  value={<>{orderBoxes(o).count}{orderBoxes(o).auto ? <span className="text-xs text-[#8A8275]"> · авто</span> : null}</>}
                  editing={editing === "boxes"}
                  onEdit={() => startEdit("boxes", { boxes: String(orderBoxes(o).count) })}
                >
                  <input className={input} inputMode="numeric" value={String(draft.boxes ?? "")} onChange={(e) => setDraft({ boxes: e.target.value.replace(/\D/g, "") })} />
                  <p className="mt-1 text-xs text-[#8A8275]">
                    Авто: 1 брелок — 1 коробка, 2 одинаковых — 1 на двоих, 3 и больше — каждому своя. Разные брелки или «каждый как подарок» — впишите число.
                  </p>
                  <SaveCancel saving={saving} onCancel={() => setEditing(null)} onSave={() => save({ boxes: Number(draft.boxes || 0) })} />
                  {!orderBoxes(o).auto && (
                    <button type="button" disabled={saving} onClick={() => save({ boxes: null })} className={`${btnPlain} mt-2 w-full`}>
                      Вернуть авто ({o.qty === 2 ? 1 : o.qty})
                    </button>
                  )}
                </Row>

                <Row
                  label="Доп. расходы"
                  value={o.extraCost ? `${o.extraCost} лей` : <span className="text-[#8A8275]">нет</span>}
                  editing={editing === "extraCost"}
                  onEdit={() => startEdit("extraCost", { extraCost: o.extraCost ? String(o.extraCost) : "" })}
                >
                  <input className={input} inputMode="numeric" placeholder="0" value={String(draft.extraCost ?? "")} onChange={(e) => setDraft({ extraCost: e.target.value.replace(/\D/g, "") })} />
                  <p className="mt-1 text-xs text-[#8A8275]">Расходы именно этого заказа сверх брелков и коробок (другой брелок, доставка за наш счёт…). Реклама — в Отчётах → Расходы.</p>
                  <SaveCancel saving={saving} onCancel={() => setEditing(null)} onSave={() => save({ extraCost: draft.extraCost ? Number(draft.extraCost) : null })} />
                </Row>

                {chatUrl && (
                  <Row
                    label="В чате производства"
                    value={
                      <button type="button" className="underline underline-offset-2" onClick={() => openTelegram(chatUrl)}>
                        Открыть сообщение заказа
                      </button>
                    }
                  />
                )}
              </Section>

              <section className="mt-4">
                <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-[#8A8275]">Комментарии</h3>
                {!loaded && !error && <p className="px-1 text-sm text-[#8A8275]">Загружаем…</p>}
                {loaded && details.comments.length === 0 && <p className="px-1 text-sm text-[#8A8275]">Пока нет</p>}
                <ul className="flex flex-col gap-2">
                  {details.comments.map((c, i) => (
                    <li key={i} className={`${card} px-3 py-2`}>
                      <div className="text-xs text-[#8A8275]">{c.authorName} · {whenLabel(c.createdAt)}</div>
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

              <section className="mt-4">
                <button type="button" onClick={() => setShowHistory(!showHistory)} className="min-h-[44px] px-1 text-xs font-semibold uppercase tracking-wide text-[#8A8275]">
                  История {showHistory ? "▲" : "▼"}
                </button>
                {showHistory && (
                  <ul className="flex flex-col gap-1 px-1 text-sm text-[#3D3832]">
                    {details.history.map((h, i) => (
                      <li key={i}>
                        <span className="text-[#8A8275]">{whenLabel(h.createdAt)} · {h.actorName}:</span>{" "}
                        {h.action === "stage"
                          ? `стадия → ${String((h.details as { to?: string }).to ?? "")}`
                          : h.action === "field"
                            ? `изменено: ${Object.keys(h.details).filter((k) => k !== "via").map((k) => FIELD_NAME[k] ?? k).join(", ")}`
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

              <button
                type="button"
                disabled={saving}
                onClick={() => void askHideOrder()}
                className="mt-8 min-h-[44px] w-full rounded-xl border border-[#B42318]/50 bg-white text-sm font-medium text-[#B42318] disabled:opacity-60"
              >
                🗑 Удалить заказ
              </button>
              <p className="mt-1 text-center text-xs text-[#8A8275]">Полностью: сообщение в чате, PDF, комментарии. С подтверждением.</p>
            </>
          )}
        </div>

        {o && (next || prev) && (
          <div className="border-t border-[#E5DCCB] bg-[#F5F1E8] px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3">
            <div className="flex gap-2">
              {prev && (
                <button type="button" disabled={saving} onClick={() => save({ stage: prev })} className={`${btnPlain} min-h-[52px] px-4`} aria-label="Вернуть на прошлую стадию">
                  ← назад
                </button>
              )}
              {next && (
                <button type="button" disabled={saving} onClick={() => save({ stage: next })} className={`${btnPrimary} min-h-[52px] flex-1 text-base`}>
                  {stepLabel(o, next)}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
