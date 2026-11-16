"use client";

// Просмотр PDF прямо в мини-приложении (без перехода в браузер): страницы рисует pdf.js в canvas.
// pdf.js (legacy-сборка 3.11 — работает и в старом Safari) лежит в /public/pdfjs и грузится только при открытии.
import { useEffect, useRef, useState } from "react";
import { ApiError, api } from "./useCrmApi";

const PDFJS = "/pdfjs/pdf-3.11.174.min.js";
const WORKER = "/pdfjs/pdf.worker-3.11.174.min.js";

type PdfPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
};
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PdfPage>; destroy: () => void };
type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (o: { data: ArrayBuffer; isEvalSupported: boolean }) => { promise: Promise<PdfDoc> };
};

let loading: Promise<PdfJs> | null = null;
function loadPdfJs(): Promise<PdfJs> {
  const w = window as Window & { pdfjsLib?: PdfJs };
  if (w.pdfjsLib) return Promise.resolve(w.pdfjsLib);
  loading ??= new Promise<PdfJs>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = PDFJS;
    s.onload = () => {
      if (!w.pdfjsLib) return reject(new Error("pdf.js не загрузился"));
      w.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER;
      resolve(w.pdfjsLib);
    };
    s.onerror = () => {
      loading = null;
      reject(new Error("pdf.js не загрузился"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

const ZOOMS = [1, 1.5, 2.5];

export default function PdfViewer({ code, onClose, onDownload }: { code: string; onClose: () => void; onDownload: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0);

  // Скачиваем файл по временной ссылке и открываем в pdf.js. Без eval (защита от вредоносных PDF).
  useEffect(() => {
    let alive = true;
    let opened: PdfDoc | null = null;
    (async () => {
      try {
        const [{ url }, pdfjs] = await Promise.all([api<{ url: string }>(`/api/crm/orders/${code}/pdf?view=1`), loadPdfJs()]);
        const res = await fetch(url);
        if (!res.ok) throw new Error("Файл не открылся");
        const data = await res.arrayBuffer();
        opened = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
        if (alive) setDoc(opened);
        else opened.destroy();
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : "Не удалось открыть PDF, попробуйте ещё раз");
      }
    })();
    return () => {
      alive = false;
      opened?.destroy();
    };
  }, [code]);

  // Рисуем страницы по ширине окна (с учётом плотности экрана — чтобы текст был чётким).
  useEffect(() => {
    const el = box.current;
    if (!doc || !el) return;
    let cancelled = false;
    (async () => {
      el.replaceChildren();
      const width = (el.clientWidth || 360) * ZOOMS[zoom];
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      for (let n = 1; n <= doc.numPages && !cancelled; n++) {
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (width / base.width) * dpr });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(width)}px`;
        canvas.style.maxWidth = "none";
        canvas.className = "mb-3 block rounded-lg bg-white shadow";
        el.appendChild(canvas);
        const ctx = canvas.getContext("2d");
        if (ctx) await page.render({ canvasContext: ctx, viewport }).promise;
      }
    })().catch(() => !cancelled && setError("Не удалось показать страницы PDF"));
    return () => {
      cancelled = true;
    };
  }, [doc, zoom]);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#3D3832]" role="dialog" aria-modal="true" aria-label={`PDF заказа ${code}`}>
      <div className="flex items-center gap-2 bg-[#191715] px-3 py-2 text-white">
        <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] rounded-lg text-xl" aria-label="Закрыть просмотр">
          ←
        </button>
        <div className="min-w-0 flex-1 truncate font-semibold">PDF #{code}{doc ? ` · ${doc.numPages} стр.` : ""}</div>
        <button
          type="button"
          onClick={() => setZoom((z) => (z + 1) % ZOOMS.length)}
          className="min-h-[40px] rounded-lg border border-white/30 px-3 text-sm"
          aria-label="Увеличить"
        >
          🔍 {ZOOMS[zoom]}×
        </button>
        <button type="button" onClick={onDownload} className="min-h-[40px] rounded-lg bg-[#FFC400] px-3 text-sm font-semibold text-[#191715]">
          ⬇️ Скачать
        </button>
      </div>
      <div className="flex-1 overflow-auto overscroll-contain p-3">
        {!doc && !error && <p className="py-10 text-center text-white/80">Открываем PDF…</p>}
        {error && <p className="mx-auto mt-10 max-w-sm rounded-xl bg-white p-4 text-center text-[#B42318]">{error}</p>}
        <div ref={box} className={zoom === 0 ? "mx-auto max-w-3xl" : ""} />
      </div>
    </div>
  );
}
