// Сторож запрета владельца: сообщения с заказами, PDF и записи заказов не удаляются.
// Исключения (решения владельца): 1) кнопка «Удалить заказ» с подтверждением стирает один заказ полностью —
// lib/crm/telegram.ts#deleteOrderMessage и lib/crm/db.ts#purgeOrder; 2) перенос заказа в тему его стадии —
// копия с тем же PDF в новую тему, затем удаление старого сообщения: lib/crm/telegram.ts#relocateOrderMessage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.(ts|tsx|mjs)$/.test(name) && !name.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

const ROOT = new URL("..", import.meta.url).pathname;
const SOURCES = ["lib", "app", "components", "scripts"].flatMap((d) => files(join(ROOT, d)));

// Единственные разрешённые места удаления сообщений: служебные подсказки и уведомления бота (не заказы).
const ALLOWED_DELETE_MESSAGE = new Set([
  "lib/telegram-bot.ts#deleteLater",
  "app/api/telegram/route.ts#notifyUpsell",
  "lib/crm/telegram.ts#deleteOrderMessage",
  "lib/crm/telegram.ts#relocateOrderMessage",
]);
// Стирание файлов хранилища и строк базы — только при полном удалении одного заказа.
const ALLOWED_PURGE = new Set(["lib/crm/db.ts#purgeOrder"]);

function fnAt(src: string, idx: number): string {
  return [...src.slice(0, idx).matchAll(/function\s+(\w+)/g)].pop()?.[1] ?? "?";
}

test("deleteMessage only in service-message helpers", () => {
  for (const file of SOURCES) {
    const rel = file.slice(ROOT.length);
    const src = readFileSync(file, "utf8");
    let idx = src.indexOf("deleteMessage");
    while (idx !== -1) {
      const fn = fnAt(src, idx);
      assert.ok(ALLOWED_DELETE_MESSAGE.has(`${rel}#${fn}`), `deleteMessage in ${rel} (${fn})`);
      idx = src.indexOf("deleteMessage", idx + 1);
    }
  }
});

test("no message moves, storage removals or row deletes", () => {
  for (const file of SOURCES) {
    const rel = file.slice(ROOT.length);
    const src = readFileSync(file, "utf8");
    assert.ok(!src.includes("moveOrder"), `moveOrder in ${rel}`);
    for (const m of src.matchAll(/\.remove\(|\.delete\(\)/g)) {
      const where = `${rel}#${fnAt(src, m.index ?? 0)}`;
      assert.ok(ALLOWED_PURGE.has(where), `${m[0]} in ${where}`);
    }
    assert.ok(!/export\s+(async\s+)?function\s+DELETE/.test(src), `DELETE route in ${rel}`);
  }
});

test("перенос между темами: старое сообщение удаляется только после копии", () => {
  const src = readFileSync(join(ROOT, "lib/crm/telegram.ts"), "utf8");
  const start = src.indexOf("async function relocateOrderMessage");
  const body = src.slice(start, src.indexOf("\n}\n", start));
  const copy = body.indexOf('"copyMessage"');
  const del = body.indexOf('"deleteMessage"');
  assert.ok(copy !== -1 && del !== -1 && copy < del, "copyMessage должен идти раньше deleteMessage");
  assert.ok(body.slice(copy, del).includes("return editInPlace"), "при ошибке копии — выход без удаления");
});
