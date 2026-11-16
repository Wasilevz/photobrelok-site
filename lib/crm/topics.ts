// Темы группы по стадиям: «В работе», «Самовывоз», «Отправка», «Завершён» — из переменных TELEGRAM_TOPIC_*,
// «Новые» — TELEGRAM_TOPIC_NEW, иначе бот создаёт тему сам (нужно право «Управление темами») и запоминает её.
import { getTopicConfig, tg } from "../telegram-orders.ts";
import { type StageThreads, topicRenames } from "./chat.ts";
import { columnLabel } from "./model.ts";
import { getSetting, saveSetting } from "./db.ts";

export type ChatTopics = { chatId: number; threads: StageThreads };

const NEW_TOPIC_NAME = columnLabel("new");
let cachedNew: number | null = null;

async function newThread(chatId: number): Promise<number | undefined> {
  const fromEnv = Number(process.env.TELEGRAM_TOPIC_NEW);
  if (Number.isInteger(fromEnv) && fromEnv > 0) return fromEnv;
  if (cachedNew) return cachedNew;
  try {
    const saved = await getSetting<{ new?: number }>("topics");
    if (saved?.new) return (cachedNew = saved.new);
    const topic = await tg<{ message_thread_id: number }>("createForumTopic", { chat_id: chatId, name: NEW_TOPIC_NAME });
    await saveSetting("topics", { new: topic.message_thread_id });
    return (cachedNew = topic.message_thread_id);
  } catch (error) {
    console.error("CRM: тема «Новые» недоступна, новые заказы — в «В работе»:", error instanceof Error ? error.message : error);
    return undefined;
  }
}

let namesChecked = false;

/**
 * Названия тем = стадии CRM («🛠 В производстве» и т. д.), чтобы кнопка и тема, куда уехал заказ, совпадали.
 * Переименовывает один раз (нужно право «Управление темами»); что уже выставлено — помнит в crm_settings.
 */
async function ensureTopicNames(chatId: number, threads: StageThreads): Promise<void> {
  if (namesChecked) return;
  namesChecked = true;
  try {
    const saved = (await getSetting<Record<string, string>>("topic_names")) ?? {};
    const todo = topicRenames(threads, saved);
    for (const { thread, name } of todo) {
      try {
        await tg("editForumTopic", { chat_id: chatId, message_thread_id: thread, name });
        saved[thread] = name;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/TOPIC_NOT_MODIFIED/i.test(message)) saved[thread] = name;
        else console.error(`CRM: тема ${thread} не переименована в «${name}»: ${message}`);
      }
    }
    if (todo.length > 0) await saveSetting("topic_names", saved);
  } catch (error) {
    namesChecked = false;
    console.error("CRM: названия тем не проверены:", error instanceof Error ? error.message : error);
  }
}

/** null — темы не настроены (нет TELEGRAM_TOPIC_*): заказы лежат как есть, меняется только подпись. */
export async function chatTopics(): Promise<ChatTopics | null> {
  const cfg = getTopicConfig();
  if (!cfg) return null;
  const chatId = Number(cfg.chatId);
  const threads: StageThreads = {
    new: await newThread(chatId),
    production: cfg.threads.work,
    pickup: cfg.threads.pickup,
    ship: cfg.threads.ship,
    done: cfg.threads.done,
  };
  await ensureTopicNames(chatId, threads);
  return { chatId, threads };
}
