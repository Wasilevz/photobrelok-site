// Смена стадии кнопкой в чате производства: то же, что в CRM (история, перенос в тему стадии).
import type { CrmUser } from "./auth.ts";
import { addHistory, getOrder, saveOrder } from "./db.ts";
import { type CrmOrder, type Stage, applyPatch, nextStage, prevStage } from "./model.ts";
import { syncChat } from "./telegram.ts";

export type StageChange = { ok: true; order: CrmOrder; changed: boolean } | { ok: false; error: string };

/** Только на соседнюю стадию (вперёд/назад) или из «Завершён» обратно в работу — защита от устаревших кнопок. */
export async function changeStageFromChat(code: string, to: Stage, actor: CrmUser): Promise<StageChange> {
  const current = await getOrder(code);
  if (!current || current.deletedAt) return { ok: false, error: "Заказ не найден в CRM" };
  if (current.stage === to) return { ok: true, order: current, changed: false };
  const allowed = to === nextStage(current.stage) || to === prevStage(current.stage) || (current.stage === "done" && to === "production");
  if (!allowed) return { ok: false, error: "Кнопка устарела — стадия уже изменена" };
  const result = applyPatch(current, { stage: to }, new Date());
  if (!result.ok) return { ok: false, error: result.error };
  const next = result.next;
  await saveOrder(code, { stage: next.stage, stage_changed_at: next.stageChangedAt });
  await addHistory(code, actor, "stage", { from: current.stage, to: next.stage, via: "chat" });
  await syncChat(current, next);
  return { ok: true, order: next, changed: true };
}
