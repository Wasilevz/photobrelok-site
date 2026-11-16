// Темы группы по стадиям: «В работе», «Самовывоз», «Отправка», «Завершён» — из переменных TELEGRAM_TOPIC_*,
// «Новые» — TELEGRAM_TOPIC_NEW, иначе бот создаёт тему сам (нужно право «Управление темами») и запоминает её.
import { getTopicConfig, tg } from "../telegram-orders.ts";
import type { StageThreads } from "./chat.ts";
import { getSetting, saveSetting } from "./db.ts";

export type ChatTopics = { chatId: number; threads: StageThreads };

const NEW_TOPIC_NAME = "🆕 Новые";
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

/** null — темы не настроены (нет TELEGRAM_TOPIC_*): заказы лежат как есть, меняется только подпись. */
export async function chatTopics(): Promise<ChatTopics | null> {
  const cfg = getTopicConfig();
  if (!cfg) return null;
  const chatId = Number(cfg.chatId);
  return {
    chatId,
    threads: {
      new: await newThread(chatId),
      production: cfg.threads.work,
      pickup: cfg.threads.pickup,
      ship: cfg.threads.ship,
      done: cfg.threads.done,
    },
  };
}
