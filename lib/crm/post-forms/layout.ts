// Координаты полей бланков (pt, отсчёт от верхнего левого угла листа шаблона), сняты с образцов
// заполнения в тех же PDF (pdftotext -bbox, образец минус сдвиг до пустого бланка). y — верх строки текста.
export type Field = { x: number; y: number; size: number; align?: "left" | "center"; maxWidth: number };

/** «Formular Trimitere ramburs»: пустой бланк — верх листа. */
export const RAMBURS = {
  /** Верхний левый угол рамки бланка (= край готового бланка почты): 4,6 мм слева, 0 сверху. */
  frame: { x: 13.04, y: 0 },
  sender: {
    name: { x: 73.6, y: 17.9, size: 10.5, maxWidth: 140 },
    street: { x: 18, y: 51, size: 10.5, maxWidth: 196 },
    locality: { x: 18, y: 74.3, size: 10.5, maxWidth: 196 },
    phone: { x: 18, y: 97.6, size: 10.5, maxWidth: 196 },
  },
  recipient: {
    name: { x: 360.4, y: 166.7, size: 10.5, maxWidth: 130 },
    street: { x: 301.8, y: 199.7, size: 10.5, maxWidth: 188 },
    locality: { x: 301.8, y: 223.1, size: 10.5, maxWidth: 188 },
    phone: { x: 301.8, y: 246.4, size: 10.5, maxWidth: 188 },
  },
  declaredDigits: { x: 341, y: 40.8, size: 10.5, align: "center", maxWidth: 44 },
  declaredWords: { x: 425.7, y: 40.8, size: 9, align: "center", maxWidth: 104 },
  codDigits: { x: 341, y: 64.1, size: 10.5, align: "center", maxWidth: 44 },
  codWords: { x: 425.7, y: 64.1, size: 9, align: "center", maxWidth: 104 },
  /** Центры квадратиков «Scrisoare / Pachet mic / Colet». */
  boxes: { scrisoare: { x: 271.8, y: 23.4 }, pachet: { x: 364, y: 23.4 }, colet: { x: 451.8, y: 23.4 } },
  /** Оранжевый треугольник «RAMBURS» — закрываем на бланке обычного отправления. */
  codMark: { x: 30, y: 124, w: 150, h: 80 },
  code: { x: 18, y: 280, size: 7, maxWidth: 120 },
} as const satisfies Record<string, unknown>;

/** «TFP-3» (перевод наложенного платежа отправителю): пустой бланк — верх первой страницы. */
export const TFP3 = {
  /** Верхний левый угол рамки бланка: 4,75 мм слева, 20,65 мм сверху. */
  frame: { x: 13.46, y: 58.54 },
  coupon: {
    sender: { x: 101, y: 94, size: 8, align: "center", maxWidth: 125 },
    recipient: { x: 101, y: 152.3, size: 8, align: "center", maxWidth: 125 },
    amount: { x: 100, y: 217.9, size: 8, align: "center", maxWidth: 60 },
    currency: [{ x: 41.4, y: 191.7 }, { x: 66.1, y: 191.7 }, { x: 90.8, y: 191.7 }],
  },
  /** Destinataire de l'envoi — получатель посылки (платит наложенный платёж). */
  recipient: {
    name: { x: 358, y: 91, size: 8, align: "center", maxWidth: 120 },
    line1: { x: 290, y: 101.8, size: 7.5, align: "center", maxWidth: 225 },
    line2: { x: 290, y: 110.2, size: 7.5, align: "center", maxWidth: 225 },
  },
  /** Nom et adresse du bénéficiaire — получатель денег (мы). */
  beneficiary: {
    // Строки стоят на линейках бланка (160.9 / 169.5 / 178.5): базовая линия на 0.8 pt выше линейки.
    name: { x: 317, y: 152.9, size: 8, align: "center", maxWidth: 150 },
    line1: { x: 317, y: 162, size: 7.5, align: "center", maxWidth: 150 },
    line2: { x: 317, y: 171, size: 7.5, align: "center", maxWidth: 150 },
  },
  currency: [{ x: 189.4, y: 226.7 }, { x: 214.1, y: 226.7 }, { x: 238.7, y: 226.7 }],
  amount: { x: 391.4, y: 226.7, size: 8, align: "center", maxWidth: 80 },
  words: { x: 317, y: 247.1, size: 8, align: "center", maxWidth: 260 },
} as const satisfies Record<string, unknown>;
