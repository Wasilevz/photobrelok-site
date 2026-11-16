// Действия кнопками в чате производства: стадия и деньги — то же, что в CRM (история, подпись, перенос в тему).
import type { CrmUser } from "./auth.ts";
import { addHistory, getOrder, saveOrder } from "./db.ts";
import { type CrmOrder, type OrderPatch, type Stage, applyPatch, nextStage, orderToRow, prevStage } from "./model.ts";
import { syncChat } from "./telegram.ts";

export type ChatChange = { ok: true; order: CrmOrder; changed: boolean } | { ok: false; error: string };

async function applyFromChat(code: string, patch: OrderPatch, actor: CrmUser, check: (o: CrmOrder) => string | null): Promise<ChatChange> {
  const current = await getOrder(code);
  if (!current || current.deletedAt) return { ok: false, error: "Заказ не найден в CRM" };
  const problem = check(current);
  if (problem) return { ok: false, error: problem };
  const result = applyPatch(current, patch, new Date());
  if (!result.ok) return { ok: false, error: result.error };
  const { next, changed } = result;
  if (changed.length === 0) return { ok: true, order: current, changed: false };
  const row = orderToRow(Object.fromEntries(changed.map((k) => [k, next[k]])));
  if (changed.includes("stage")) row.stage_changed_at = next.stageChangedAt;
  await saveOrder(code, row);
  if (changed.includes("stage")) await addHistory(code, actor, "stage", { from: current.stage, to: next.stage, via: "chat" });
  const fields = changed.filter((k) => k !== "stage");
  if (fields.length > 0) await addHistory(code, actor, "field", { ...Object.fromEntries(fields.map((k) => [k, [current[k], next[k]]])), via: "chat" });
  await syncChat(current, next);
  return { ok: true, order: next, changed: true };
}

/** Только на соседнюю стадию (вперёд/назад) или из «Завершён» обратно в работу — защита от устаревших кнопок. */
export function changeStageFromChat(code: string, to: Stage, actor: CrmUser): Promise<ChatChange> {
  return applyFromChat(code, { stage: to }, actor, (o) =>
    o.stage === to || to === nextStage(o.stage) || to === prevStage(o.stage) || (o.stage === "done" && to === "production")
      ? null
      : "Кнопка устарела — стадия уже изменена",
  );
}

/** «💰 Деньги получены» / «↩️ Не забрали» — только у завершённых (отправленных) заказов. */
export function changeMoneyFromChat(code: string, money: "received" | "returned", actor: CrmUser): Promise<ChatChange> {
  return applyFromChat(code, { money }, actor, (o) => (o.stage === "done" ? null : "Сначала отметьте, что заказ отправлен"));
}
