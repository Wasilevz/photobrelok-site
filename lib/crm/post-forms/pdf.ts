// Сборка PDF с почтовыми бланками: шаблон официального бланка + данные заказа поверх.
// Неоплаченный заказ — лист A4: бланк отправления с RAMBURS + TFP-3. Оплаченные — по два бланка без сумм на лист.
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFEmbeddedPage, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import type { FormData, Sender } from "./data.ts";
import { type Field, RAMBURS, TFP3 } from "./layout.ts";

const ASSETS = path.join(process.cwd(), "lib/crm/post-forms/assets");
const A4 = { w: 595.304, h: 841.89 };
const INK = rgb(0, 0, 0);

type Ctx = { page: PDFPage; font: PDFFont; dy: number };

function put(c: Ctx, f: Field, text: string): void {
  if (!text) return;
  let size = f.size;
  while (size > 5 && c.font.widthOfTextAtSize(text, size) > f.maxWidth) size -= 0.25;
  const width = c.font.widthOfTextAtSize(text, size);
  const x = f.align === "center" ? f.x - width / 2 : f.x;
  // y поля — верх строки (как у pdftotext); базовая линия ниже на высоту надстрочной части.
  c.page.drawText(text, { x, y: A4.h - (f.y + c.dy) - size * 0.905, size, font: c.font, color: INK });
}

function letters(c: Ctx, cells: readonly { x: number; y: number }[], text: string): void {
  cells.forEach((cell, i) => put(c, { x: cell.x, y: cell.y, size: 8, align: "center", maxWidth: 10 }, text[i] ?? ""));
}

function cross(c: Ctx, at: { x: number; y: number }): void {
  const r = 3.2;
  const y = A4.h - (at.y + c.dy);
  c.page.drawLine({ start: { x: at.x - r, y: y - r }, end: { x: at.x + r, y: y + r }, thickness: 1.2, color: INK });
  c.page.drawLine({ start: { x: at.x - r, y: y + r }, end: { x: at.x + r, y: y - r }, thickness: 1.2, color: INK });
}

function cutLine(page: PDFPage, y: number): void {
  page.drawLine({
    start: { x: 18, y: A4.h - y },
    end: { x: A4.w - 18, y: A4.h - y },
    thickness: 0.6,
    dashArray: [4, 3],
    color: rgb(0.5, 0.5, 0.5),
  });
}

/** Шаблон вырезается по crop и ставится так, что его верх оказывается на высоте top. */
function place(page: PDFPage, tpl: PDFEmbeddedPage, crop: { top: number; bottom: number }, top: number): number {
  const dy = top - crop.top;
  page.drawPage(tpl, { x: 0, y: A4.h - (crop.bottom + dy) });
  return dy;
}

function drawRamburs(c: Ctx, s: Sender, d: FormData): void {
  const L = RAMBURS;
  if (!d.cod) {
    c.page.drawRectangle({ x: L.codMark.x, y: A4.h - (L.codMark.y + c.dy) - L.codMark.h, width: L.codMark.w, height: L.codMark.h, color: rgb(1, 1, 1) });
  }
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
  put(c, { ...L.code, size: 7 }, `#${d.code}`);
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

export async function buildPostFormsPdf(forms: FormData[], sender: Sender): Promise<Uint8Array> {
  const [rambursBytes, tfpBytes, fontBytes] = await Promise.all([
    readFile(path.join(ASSETS, "ramburs.pdf")),
    readFile(path.join(ASSETS, "tfp3.pdf")),
    readFile(path.join(ASSETS, "LiberationSans-Bold.ttf")),
  ]);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });
  const [rambursSrc, tfpSrc] = await Promise.all([PDFDocument.load(rambursBytes), PDFDocument.load(tfpBytes)]);
  const crop = (c: { top: number; bottom: number }) => ({ left: 0, right: A4.w, top: A4.h - c.top, bottom: A4.h - c.bottom });
  const cutR = await doc.embedPage(rambursSrc.getPage(0), crop(RAMBURS.crop));
  const cutT = await doc.embedPage(tfpSrc.getPage(0), crop(TFP3.crop));

  const cod = forms.filter((f) => f.cod);
  const plain = forms.filter((f) => !f.cod);

  for (const d of cod) {
    const page = doc.addPage([A4.w, A4.h]);
    const dyR = place(page, cutR, RAMBURS.crop, 18);
    drawRamburs({ page, font, dy: dyR }, sender, d);
    cutLine(page, 323);
    const dyT = place(page, cutT, TFP3.crop, 335);
    drawTfp3({ page, font, dy: dyT }, sender, d);
  }
  for (let i = 0; i < plain.length; i += 2) {
    const page = doc.addPage([A4.w, A4.h]);
    const dy1 = place(page, cutR, RAMBURS.crop, 18);
    drawRamburs({ page, font, dy: dy1 }, sender, plain[i]);
    if (plain[i + 1]) {
      cutLine(page, A4.h / 2);
      const dy2 = place(page, cutR, RAMBURS.crop, A4.h / 2 + 18);
      drawRamburs({ page, font, dy: dy2 }, sender, plain[i + 1]);
    }
  }
  return doc.save();
}
