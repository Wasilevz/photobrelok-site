// PDF для печати на готовые бланки Poșta Moldovei: одна страница = один бланк, размер страницы = размер бланка,
// печатается только текст (линии и надписи уже есть на бланке). Пробная печать — тот же текст плюс
// контур бланка, чтобы на обычной бумаге приложить к настоящему бланку на просвет.
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import type { BlankKind, BlankPrint, FormData, Sender } from "./data.ts";
import { type Field, RAMBURS, TFP3 } from "./layout.ts";

const ASSETS = path.join(process.cwd(), "lib/crm/post-forms/assets");
const TEMPLATE_H = 841.89; // высота листа A4 шаблона, pt
const MM = 72 / 25.4;
const INK = rgb(0, 0, 0);

/** Перевод координат шаблона (pt от угла листа A4) в координаты страницы-бланка. */
type Ctx = { page: PDFPage; font: PDFFont; fx: number; fy: number; dx: number; dy: number; pageH: number };

function put(c: Ctx, f: Field, text: string): void {
  if (!text) return;
  let size = f.size;
  while (size > 5 && c.font.widthOfTextAtSize(text, size) > f.maxWidth) size -= 0.25;
  const width = c.font.widthOfTextAtSize(text, size);
  const x = (f.align === "center" ? f.x - width / 2 : f.x) - c.fx + c.dx;
  // y поля — верх строки (как у pdftotext); базовая линия ниже на высоту надстрочной части.
  const y = c.pageH - (f.y - c.fy + c.dy) - size * 0.905;
  c.page.drawText(text, { x, y, size, font: c.font, color: INK });
}

function letters(c: Ctx, cells: readonly { x: number; y: number }[], text: string): void {
  cells.forEach((cell, i) => put(c, { x: cell.x, y: cell.y, size: 8, align: "center", maxWidth: 10 }, text[i] ?? ""));
}

function cross(c: Ctx, at: { x: number; y: number }): void {
  const r = 3.2;
  const x = at.x - c.fx + c.dx;
  const y = c.pageH - (at.y - c.fy + c.dy);
  c.page.drawLine({ start: { x: x - r, y: y - r }, end: { x: x + r, y: y + r }, thickness: 1.2, color: INK });
  c.page.drawLine({ start: { x: x - r, y: y + r }, end: { x: x + r, y: y - r }, thickness: 1.2, color: INK });
}

function drawRamburs(c: Ctx, s: Sender, d: FormData): void {
  const L = RAMBURS;
  put(c, L.sender.name, s.name);
  put(c, L.sender.street, s.street);
  put(c, L.sender.locality, s.locality);
  put(c, L.sender.phone, s.phone);
  put(c, L.recipient.name, d.recipient.name);
  put(c, L.recipient.street, d.recipient.street);
  put(c, L.recipient.locality, d.recipient.locality);
  put(c, L.recipient.phone, d.recipient.phone);
  cross(c, L.boxes[s.parcelType]);
  put(c, L.declaredDigits, d.declaredDigits);
  put(c, L.declaredWords, d.declaredWords);
  put(c, L.codDigits, d.amountDigits);
  put(c, L.codWords, d.cod ? d.amountWords.replace(/ lei, zero bani$/, "").toLowerCase() : "");
  put(c, L.code, `#${d.code}`);
}

function drawTfp3(c: Ctx, s: Sender, d: FormData): void {
  const L = TFP3;
  const beneficiary =
    s.payout === "card" ? [s.name, `IDNP: ${s.idnp}`, s.iban] : [s.name, `${s.street}, tel. ${s.phone}`, `${s.locality}, REPUBLICA MOLDOVA`];
  put(c, L.coupon.sender, s.name);
  put(c, L.coupon.recipient, d.recipient.name);
  put(c, L.coupon.amount, d.amountCents);
  letters(c, L.coupon.currency, "MDL");
  put(c, L.recipient.name, d.recipient.name);
  put(c, L.recipient.line1, [d.recipient.street, `tel. ${d.recipient.phone}`].filter(Boolean).join(", "));
  put(c, L.recipient.line2, `${d.recipient.locality}, REPUBLICA MOLDOVA`);
  put(c, L.beneficiary.name, beneficiary[0]);
  put(c, L.beneficiary.line1, beneficiary[1]);
  put(c, L.beneficiary.line2, beneficiary[2]);
  letters(c, L.currency, "MDL");
  put(c, L.amount, d.amountCents);
  put(c, L.words, d.amountWords);
}

/**
 * kind = "ramburs": бланк отправления на каждый заказ (у оплаченных — без сумм).
 * kind = "tfp3": TFP-3 только для неоплаченных (наложенный платёж).
 */
export async function buildBlankPdf(
  forms: FormData[],
  sender: Sender,
  kind: BlankKind,
  print: BlankPrint,
  opts: { test?: boolean } = {},
): Promise<Uint8Array> {
  const list = kind === "tfp3" ? forms.filter((f) => f.cod) : forms;
  const L = kind === "ramburs" ? RAMBURS : TFP3;
  const [fontBytes, tplBytes] = await Promise.all([
    readFile(path.join(ASSETS, "LiberationSans-Bold.ttf")),
    opts.test ? readFile(path.join(ASSETS, kind === "ramburs" ? "ramburs.pdf" : "tfp3.pdf")) : Promise.resolve(null),
  ]);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });
  const W = print.w * MM;
  const H = print.h * MM;

  let tpl = null;
  if (tplBytes) {
    const src = await PDFDocument.load(tplBytes);
    tpl = await doc.embedPage(src.getPage(0), {
      left: L.frame.x,
      right: L.frame.x + W,
      top: TEMPLATE_H - L.frame.y,
      bottom: TEMPLATE_H - L.frame.y - H,
    });
  }

  for (const d of list) {
    const page = doc.addPage([W, H]);
    if (tpl) page.drawPage(tpl, { x: 0, y: 0, opacity: 0.35 });
    const c: Ctx = { page, font, fx: L.frame.x, fy: L.frame.y, dx: print.dx * MM, dy: print.dy * MM, pageH: H };
    if (kind === "ramburs") drawRamburs(c, sender, d);
    else drawTfp3(c, sender, d);
  }
  return doc.save();
}
