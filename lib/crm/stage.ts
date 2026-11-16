// Одно место, где меняется заказ: из карточки CRM и кнопками в чате производства. Проверка правки, сохранение
// только изменённых полей, история и обновление сообщения в чате (подпись, кнопки, перенос в тему стадии).
import type { CrmUser } from "./auth.ts";
import { addHistory, getOrder, saveOrder } from "./db.ts";
import { type CrmOrder, type OrderPatch, type Stage, applyPatch, nextStage, orderToRow, prevStage } from "./model.ts";
import { syncChat } from "./telegram.ts";

export type Change =
  | { ok: true; order: CrmOrder; changed: boolean; warnings: string[] }
  | { ok: false; error: string; status: number };

type Options = { via?: "chat"; check?: (o: CrmOrder) => string | null };

export async function changeOrder(code: string, patch: OrderPatch, actor: CrmUser, { via, check }: Options = {}): Promise<Change> {
  const current = await getOrder(code);
  if (!current) return { ok: false, error: via ? "Заказ не найден в CRM" : "Заказ не найден", status: 404 };
  if (current.deletedAt) return { ok: false, error: "Заказ удалён из CRM", status: 409 };
  const problem = check?.(current);
  if (problem) return { ok: false, error: problem, status: 409 };
  const result = applyPatch(current, patch, new Date());
  if (!result.ok) return { ok: false, error: result.error, status: 400 };
  const { next, changed, warnings } = result;
  if (changed.length === 0) return { ok: true, order: current, changed: false, warnings };

  // Сохраняем только изменённые поля: параллельная правка другого поля не затирается.
  const row = orderToRow(Object.fromEntries(changed.map((k) => [k, next[k]])));
  if (changed.includes("stage")) row.stage_changed_at = next.stageChangedAt;
  await saveOrder(code, row);

  const mark = via ? { via } : {};
  const entries: Parameters<typeof addHistory>[2] = [];
  if (changed.includes("stage")) entries.push({ action: "stage", details: { from: current.stage, to: next.stage, ...mark } });
  const fields = changed.filter((k) => k !== "stage");
  if (fields.length > 0) entries.push({ action: "field", details: { ...Object.fromEntries(fields.map((k) => [k, [current[k], next[k]]])), ...mark } });
  await Promise.all([addHistory(code, actor, entries), syncChat(current, next)]);
  return { ok: true, order: next, changed: true, warnings };
}

/** Только на соседнюю стадию (вперёд/назад) или из «Завершён» обратно в работу — защита от устаревших кнопок. */
export function changeStageFromChat(code: string, to: Stage, actor: CrmUser): Promise<Change> {
  return changeOrder(code, { stage: to }, actor, {
    via: "chat",
    check: (o) =>
      o.stage === to || to === nextStage(o.stage) || to === prevStage(o.stage) || (o.stage === "done" && to === "production")
        ? null
        : "Кнопка устарела — стадия уже изменена",
  });
}

/** «💰 Деньги получены» / «↩️ Не забрали» — только у завершённых (отправленных) заказов. */
export function changeMoneyFromChat(code: string, money: "received" | "returned", actor: CrmUser): Promise<Change> {
  return changeOrder(code, { money }, actor, { via: "chat", check: (o) => (o.stage === "done" ? null : "Сначала отметьте, что заказ отправлен") });
}
