// Перенос прошлых заказов из выгрузки чата в CRM.
//   node scripts/import-telegram-export.mjs <result.json> [--topics=16,19] > import.sql
// Печатает SQL (вставка без перезаписи) для Supabase SQL Editor или MCP. Файл выгрузки с телефонами
// клиентов в репозиторий не кладите.
import { readFileSync } from "node:fs";
import { importSql, parseExport } from "../lib/crm/import.ts";

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error("Usage: node scripts/import-telegram-export.mjs <result.json> [--topics=WORK,DONE] [--summary]");
  process.exit(1);
}
const topicsFlag = flags.find((f) => f.startsWith("--topics="));
const [work, done] = (topicsFlag ? topicsFlag.slice(9) : "16,19").split(",").map(Number);
const orders = parseExport(JSON.parse(readFileSync(file, "utf8")), { work, done });

if (flags.includes("--summary")) {
  const stages = orders.reduce((acc, o) => ({ ...acc, [o.stage]: (acc[o.stage] ?? 0) + 1 }), {});
  console.log(JSON.stringify({ orders: orders.length, stages, comments: orders.reduce((n, o) => n + o.comments.length, 0) }));
} else {
  console.log(importSql(orders));
}
