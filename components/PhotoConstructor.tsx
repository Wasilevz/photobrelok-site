"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import ImageCropper from "@/components/ImageCropper";
import OrderModal from "@/components/OrderModal";
import type { DeliveryData, UploadProgress } from "@/components/OrderModal";
import { useRouter } from 'next/navigation';
import { useLanguage } from "@/context/LanguageContext";
import { telegramLink } from "@/lib/contacts";
import { metaEventId, track } from "@/lib/analytics";

const MAX_SLOTS = 10;

export default function PhotoConstructor() {
  const router = useRouter();
  const { lang, dict } = useLanguage();
  const [slots, setSlots] = useState<(string | null)[]>(Array(MAX_SLOTS).fill(null));
  // Хэши исходных файлов — по ним ловим повторный выбор того же фото в галерее
  const [slotHashes, setSlotHashes] = useState<(string | null)[]>(Array(MAX_SLOTS).fill(null));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const longPressRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const [scrollThumb, setScrollThumb] = useState({ width: 0.4, left: 0 });
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showError, setShowError] = useState<string | null>(null);
  const uploadedUrls = useRef<Map<string, string>>(new Map());
  const [telegramFallback, setTelegramFallback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Батч-загрузка: очередь фото, ожидающих обрезки, каждое привязано к своему слоту
  const [cropQueue, setCropQueue] = useState<{ url: string; slotIndex: number; hash: string }[]>([]);
  const [totalInBatch, setTotalInBatch] = useState(0);
  const imageToCrop = cropQueue[0]?.url ?? null;
  const photoCount = slots.filter(Boolean).length;

  // Сообщаем лендингу количество фото — для sticky CTA
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("photobrelok_slots", { detail: photoCount }));
  }, [photoCount]);

  const revokeOldUrl = useCallback((url: string | null) => {
    if (url && url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  }, []);

  /** Хэш содержимого файла — одинаковое фото даёт одинаковый хэш даже с разными именами */
  const hashFile = async (file: File): Promise<string> => {
    try {
      const buf = await file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", buf);
      return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // вне secure context (http по сети) crypto.subtle недоступен — слабый запасной ключ
      return `${file.size}:${file.lastModified}:${file.name}`;
    }
  };

  useEffect(() => {
    handleCarouselScroll();
    const onResize = () => handleCarouselScroll();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleSlotClick = (index: number) => {
    if (slots[index]) {
      // Занятый слот: тап выделяет кадр и показывает панель управления (на мобиле hover нет)
      setSelectedSlot((prev) => (prev === index ? null : index));
      return;
    }
    setActiveSlotIndex(index);
    fileInputRef.current?.click();
  };

  const handleReplaceSelected = () => {
    if (selectedSlot === null) return;
    setActiveSlotIndex(selectedSlot);
    fileInputRef.current?.click();
  };

  /** Сдвиг фото на один кадр влево/вправо (обмен со соседним слотом) */
  const moveSlot = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= MAX_SLOTS) return;
    setSlots((prev) => {
      const next = [...prev];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
    setSlotHashes((prev) => {
      const next = [...prev];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
    setSelectedSlot(to);
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsReadingFiles(true);
    try {
      const fileArray = Array.from(files);
    e.target.value = "";

    // Дедупликация: фото, которое уже есть в слотах или встречается в этой же пачке, пропускаем
    const seenInBatch = new Set<string>();
    const dupSlots: number[] = [];
    const accepted: { file: File; hash: string }[] = [];
    for (const file of fileArray) {
      const hash = await hashFile(file);
      const alreadySlot = slotHashes.findIndex((h) => h === hash);
      if (alreadySlot !== -1) {
        dupSlots.push(alreadySlot + 1);
        continue;
      }
      if (seenInBatch.has(hash)) continue;
      seenInBatch.add(hash);
      accepted.push({ file, hash });
    }

    const messages: string[] = [];
    if (dupSlots.length === 1) messages.push(dict.home.photoAlreadyAdded(dupSlots[0]));
    else if (dupSlots.length > 1) messages.push(dict.home.photosAlreadyAdded(dupSlots.join(", ")));

    // Слот, на который кликнули, заполняется первым (даже если уже занят — это "заменить")
    const targetIndices: number[] = [];
    if (activeSlotIndex !== null) targetIndices.push(activeSlotIndex);

    // Остальные фото уходят в следующие свободные слоты по порядку
    for (let i = 0; i < slots.length && targetIndices.length < accepted.length; i++) {
      if (i === activeSlotIndex) continue;
      if (!slots[i]) targetIndices.push(i);
    }

    const queue: { url: string; slotIndex: number; hash: string }[] = [];
    for (let i = 0; i < targetIndices.length && i < accepted.length; i++) {
      queue.push({ url: URL.createObjectURL(accepted[i].file), slotIndex: targetIndices[i], hash: accepted[i].hash });
    }
    setActiveSlotIndex(null);

    if (accepted.length > targetIndices.length) {
      messages.push(dict.home.uploadTruncated(queue.length, fileArray.length));
    }
    if (messages.length > 0) setShowError(messages.join(" · "));

    if (queue.length === 0) return;
    setCropQueue(queue);
    setTotalInBatch(queue.length);
    } finally {
      setIsReadingFiles(false);
    }
  };

  const handleCropDone = (croppedImageUrl: string) => {
    const current = cropQueue[0];
    if (current) {
      // The cropper creates a new object URL; release the original upload URL.
      revokeOldUrl(current.url);
      setSlots((prev) => {
        const newSlots = [...prev];
        revokeOldUrl(newSlots[current.slotIndex]);
        newSlots[current.slotIndex] = croppedImageUrl;
        return newSlots;
      });
      setSlotHashes((prev) => {
        const next = [...prev];
        next[current.slotIndex] = current.hash;
        return next;
      });
    }
    const rest = cropQueue.slice(1);
    setCropQueue(rest);
    if (rest.length === 0) setTotalInBatch(0);
  };

  /** Пропустить только текущий кадр, остальные продолжить обрезку */
  const handleCropSkip = () => {
    const current = cropQueue[0];
    if (current) revokeOldUrl(current.url);
    const rest = cropQueue.slice(1);
    setCropQueue(rest);
    if (rest.length === 0) setTotalInBatch(0);
  };

  /** Отменить всю оставшуюся пачку */
  const handleCropCancel = () => {
    const current = cropQueue[0];
    if (current) revokeOldUrl(current.url);

    const rest = cropQueue.slice(1);

    // Cancel the rest of this batch and release its temporary object URLs.
    rest.forEach((item) => revokeOldUrl(item.url));
    setCropQueue([]);
    setTotalInBatch(0);
  };

  const handleCarouselScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const width = el.scrollWidth > 0 ? el.clientWidth / el.scrollWidth : 1;
    const left = max > 0 ? (el.scrollLeft / max) * (1 - width) : 0;
    setScrollThumb({ width: Math.min(1, width), left });
  };

  const onScrollThumbPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const bar = e.currentTarget.parentElement;
    const el = scrollContainerRef.current;
    if (!bar || !el) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const barRect = bar.getBoundingClientRect();
    const thumbWidthPx = barRect.width * scrollThumb.width;

    const moveTo = (clientX: number) => {
      const ratio = Math.min(1, Math.max(0, (clientX - barRect.left - thumbWidthPx / 2) / (barRect.width - thumbWidthPx || 1)));
      el.scrollLeft = ratio * (el.scrollWidth - el.clientWidth);
    };
    moveTo(e.clientX);

    const onMove = (ev: PointerEvent) => moveTo(ev.clientX);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const clearLongPress = () => {
    if (longPressRef.current !== null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const vibrate = (ms: number) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(ms);
      } catch {
        /* ignore */
      }
    }
  };

  const startLongPress = (index: number, clientX: number, clientY: number) => {
    if (!slots[index]) return;
    clearLongPress();
    pointerStartRef.current = { x: clientX, y: clientY };
    longPressRef.current = window.setTimeout(() => {
      draggingRef.current = true;
      setDragIndex(index);
      setOverIndex(index);
      vibrate(35);
    }, 420);
  };

  const moveDragTarget = (clientX: number, clientY: number) => {
    if (!draggingRef.current || dragIndex === null) return;
    const stack = document.elementsFromPoint(clientX, clientY);
    for (const node of stack) {
      const slot = (node as HTMLElement).closest?.("[data-slot]") as HTMLElement | null;
      if (slot && slot.dataset.slot != null) {
        const idx = Number(slot.dataset.slot);
        if (Number.isFinite(idx) && idx !== dragIndex) {
          setOverIndex(idx);
        }
        break;
      }
    }
  };

  const finishDrag = () => {
    clearLongPress();
    if (draggingRef.current && dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      const from = dragIndex;
      const to = overIndex;
      setSlots((prev) => {
        const next = [...prev];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item ?? null);
        while (next.length < MAX_SLOTS) next.push(null);
        return next.slice(0, MAX_SLOTS);
      });
      setSlotHashes((prev) => {
        const next = [...prev];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item ?? null);
        while (next.length < MAX_SLOTS) next.push(null);
        return next.slice(0, MAX_SLOTS);
      });
      vibrate(25);
      setSelectedSlot(null);
    }
    draggingRef.current = false;
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleRemoveSlot = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSlots = [...slots];
    revokeOldUrl(newSlots[index]);
    newSlots[index] = null;
    setSlots(newSlots);
    setSlotHashes((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
    setSelectedSlot((prev) => (prev === index ? null : prev));
  };

  const handleFinalSubmit = async (userData: { name: string; phone: string; delivery: DeliveryData; marketingConsent: boolean; website: string }) => {
    setIsSubmitting(true);
    try {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
      if (!cloudName || !uploadPreset) {
        throw new Error(
          lang === "ru"
            ? "Загрузка фото не настроена. Напишите нам — поможем оформить заказ."
            : "Încărcarea pozelor nu e configurată. Scrie-ne — te ajutăm cu comanda."
        );
      }

      const filled = slots.filter((url): url is string => !!url);
      if (filled.length < 6) {
        throw new Error(
          lang === "ru"
            ? "Для заказа нужно минимум 6 фото. Добавьте ещё недостающие кадры."
            : "Pentru comandă sunt necesare minim 6 poze. Adăugați pozele lipsă."
        );
      }

      setUploadProgress({ uploaded: 0, total: filled.length, stage: "uploading" });

      let uploadedCounter = 0;
      const photoUrls: string[] = [];
      const uploadOne = async (blobUrl: string) => {
        // Повторная отправка после сбоя не заливает уже загруженные фото заново
        const cached = uploadedUrls.current.get(blobUrl);
        if (cached) {
          uploadedCounter += 1;
          setUploadProgress({ uploaded: uploadedCounter, total: filled.length, stage: "uploading" });
          return cached;
        }
        const res = await fetch(blobUrl);
        const blob = await res.blob();
        const formData = new FormData();
        formData.append("file", blob, `photo_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`);
        formData.append("upload_preset", uploadPreset);
        const cloudRes = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          { method: "POST", body: formData }
        );
        const data = await cloudRes.json();
        if (!cloudRes.ok) throw new Error(dict.errors.uploadFailed);
        uploadedCounter += 1;
        setUploadProgress({ uploaded: uploadedCounter, total: filled.length, stage: "uploading" });
        uploadedUrls.current.set(blobUrl, data.secure_url as string);
        return data.secure_url as string;
      };

      const batch = 3;
      for (let i = 0; i < filled.length; i += batch) {
        const chunk = filled.slice(i, i + batch);
        const urls = await Promise.all(chunk.map(uploadOne));
        photoUrls.push(...urls);
      }

      setUploadProgress({ uploaded: filled.length, total: filled.length, stage: "finishing" });

      const metaEventIds = { lead: metaEventId(), purchase: metaEventId() };
      const apiRes = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userData.name,
          phone: userData.phone,
          photoUrls,
          lang,
          delivery: userData.delivery,
          metaEventIds,
          marketingConsent: userData.marketingConsent,
          website: userData.website,
        }),
      });

      if (!apiRes.ok) {
        const errData = await apiRes.json().catch(() => null);
        throw new Error(errData?.error || dict.errors.genericSubmit);
      }

      const { orderId, upsellToken } = await apiRes.json();
      try {
        // Страница «Спасибо» по этому токену допишет апселл в сообщение заказа в Telegram
        if (upsellToken) window.sessionStorage.setItem(`photobrelok_upsell_${orderId}`, upsellToken);
      } catch {
        // sessionStorage недоступен: апселл уйдёт отдельным сообщением
      }
      track("order_api_success", {
        orderId,
        name: userData.name,
        phone: userData.phone,
        metaEventIds,
      });

      slots.forEach(revokeOldUrl);
      setSlots(Array(MAX_SLOTS).fill(null));
      setSlotHashes(Array(MAX_SLOTS).fill(null));
      setSelectedSlot(null);
      setIsModalOpen(false);
      setTelegramFallback(null);
      router.push(`/thanks?orderId=${orderId}`);

    } catch (err: unknown) {
      setUploadProgress(null);
      const msg = err instanceof Error ? err.message : dict.errors.unknown;
      setShowError(msg);
      setTelegramFallback(
        telegramLink(
          lang === "ru"
            ? `Здравствуйте! Не получилось отправить заказ с сайта. Имя: ${userData.name}, телефон: ${userData.phone}. Пришлю фото в этот чат.`
            : `Bună ziua! Nu am putut trimite comanda de pe site. Nume: ${userData.name}, telefon: ${userData.phone}. Trimit pozele în acest chat.`
        )
      );
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  return (
    <div id="constructor" className="bg-[#FAF9F5] text-[#141413] py-10 font-sans selection:bg-white/40">
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileChange}
        accept="image/*"
        multiple
        className="hidden"
      />

      {/* Language switch lives in the page header only */}

      {/* Title/subtitle/price live in the landing section above — keep constructor UI only */}

      {/* Film strip + Kodak canister: film feeds into the keychain body */}
      {isReadingFiles && (
        <div className="max-w-md mx-auto mb-4 px-4 py-3 bg-[#C96442]/25 border-2 border-[#141413] rounded-xl flex items-center justify-center gap-2.5 text-xs font-bold text-[#141413] animate-pulse shadow-sm">
          <span className="inline-block size-3.5 rounded-full border-2 border-[#141413] border-t-transparent animate-spin" />
          <span>{lang === "ru" ? "Обработка выбранных фото..." : "Se procesează pozele selectate..."}</span>
        </div>
      )}
      <div className="relative w-full max-w-none w-full mx-auto mt-10 sm:mt-10 px-2 sm:px-4 pt-2">
        {/* Stage: film track + canister as one object */}
        <div className="relative pb-stage">
          <div
            id="film-scroll"
            ref={scrollContainerRef}
            tabIndex={0}
            role="region"
            aria-label={lang === "ru" ? "Фотоплёнка, прокрутка стрелками" : "Film foto, derulare cu săgeți"}
            className="w-full min-w-0 overflow-x-auto no-scrollbar"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              overscrollBehaviorX: 'contain',
              // поле справа — чтобы плёнка уходила «в» катушку, а не обрезалась
              paddingRight: 0,
            }}
            onScroll={handleCarouselScroll}
          >
            <style>{`
              .no-scrollbar::-webkit-scrollbar { display: none !important; }
              /* Film height ≈ 0.65 × canister — matches film-exit tabs on the Kodak body */
              .pb-stage {
                position: relative;
                display: flex;
                align-items: center;
                min-height: 340px;
                /* film must stop at the canister’s left edge — never show on its right */
                padding-right: 130px;
              }
              .pb-film-track {
                height: 200px;
                width: max-content;
                min-width: 100%;
                padding-left: 48px;
                padding-right: 28px;
                gap: 6px;
                background-color: #111;
                /* KS perfs: 2×2.5mm hole, 4.75mm pitch — scaled to film height */
                background-image:
                  url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2219%22 height=%2212%22%3E%3Crect x=%221%22 y=%221%22 width=%228%22 height=%2210%22 rx=%222%22 fill=%22%23f0ebe1%22/%3E%3C/svg%3E"),
                  url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2219%22 height=%2212%22%3E%3Crect x=%221%22 y=%221%22 width=%228%22 height=%2210%22 rx=%222%22 fill=%22%23f0ebe1%22/%3E%3C/svg%3E");
                background-size: 19px 11px, 19px 11px;
                background-position: 0 7px, 0 calc(100% - 7px);
                background-repeat: repeat-x, repeat-x;
                box-shadow: inset 0 0 0 1px rgba(255,255,255,0.05);
              }
              .pb-slot {
                width: 146px;
                height: 146px;
              }
              .pb-throat {
                width: 72px;
                height: 200px;
                right: 52px;
              }
              .pb-film-throat {
                background: linear-gradient(90deg, #111 0%, #111 50%, #141210 72%, #1F1E1D 88%, #221c16 100%);
              }
              .pb-tongue {
                width: 56px;
                height: 32px;
                right: 58px;
              }
              .pb-canister {
                width: 168px;
                height: 292px;
                right: -6px;
                /* жёлое тело PNG сидит ниже геометрического центра — компенсируем */
                transform: translateY(calc(-50% - 12px));
              }
              .pb-scroll-bar {
                position: relative;
                width: min(420px, 100%);
                height: 8px;
                margin-top: 14px;
                border-radius: 999px;
                background: #e4ddd0;
                border: 1px solid #C8C6BC;
                cursor: pointer;
                touch-action: none;
              }
              .pb-scroll-thumb {
                position: absolute;
                top: -1px;
                height: 8px;
                border-radius: 999px;
                background: #141413;
                min-width: 36px;
                cursor: grab;
                touch-action: none;
              }
              .pb-scroll-thumb:active {
                cursor: grabbing;
              }
              @media (min-width: 640px) {
                .pb-stage {
                  min-height: 420px;
                  padding-right: 170px;
                }
                .pb-film-track {
                  height: 240px;
                  width: max-content;
                  min-width: 100%;
                  padding-left: 56px;
                  padding-right: 32px;
                  gap: 8px;
                  background-size: 22px 14px, 22px 14px;
                  background-position: 0 9px, 0 calc(100% - 9px);
                }
                .pb-slot {
                  width: 174px;
                  height: 174px;
                }
                .pb-throat {
                  width: 90px;
                  height: 240px;
                  right: 68px;
                }
                .pb-tongue {
                  width: 70px;
                  height: 40px;
                  right: 74px;
                }
                .pb-canister {
                  width: 200px;
                  height: 348px;
                  right: -10px;
                  transform: translateY(calc(-50% - 14px));
                }
              }
            `}</style>

            <div
              className="pb-film-track relative flex items-center rounded-l-[10px] shrink-0"
            >
              {/* Кольцо брелока — слева, как отверстие на настоящей плёнке (PDF: 5.3mm) */}
              <div className="absolute left-[10px] top-1/2 -translate-y-1/2 z-10 w-[34px] h-[34px] sm:w-[40px] sm:h-[40px] rounded-full overflow-hidden pointer-events-none opacity-95">
                <Image
                  src="/ring.png"
                  alt=""
                  width={40}
                  height={40}
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="flex gap-[8px] z-10 ml-1 relative w-max shrink-0">
                {slots.map((url, index) => (
                  <div
                    key={index}
                    data-slot={index}
                    onClick={() => {
                      if (draggingRef.current) return;
                      handleSlotClick(index);
                    }}
                    onPointerDown={(e) => {
                      if (e.button !== undefined && e.button !== 0) return;
                      startLongPress(index, e.clientX, e.clientY);
                    }}
                    onPointerMove={(e) => {
                      if (!draggingRef.current && longPressRef.current !== null && pointerStartRef.current) {
                        // отмена long-press, если палец сдвинулся — это скролл плёнки, а не перетаскивание
                        const dx = Math.abs(e.clientX - pointerStartRef.current.x);
                        const dy = Math.abs(e.clientY - pointerStartRef.current.y);
                        if (dx > 10 || dy > 10) clearLongPress();
                      }
                      moveDragTarget(e.clientX, e.clientY);
                    }}
                    onPointerUp={finishDrag}
                    onPointerCancel={finishDrag}
                    onPointerLeave={() => {
                      if (!draggingRef.current) clearLongPress();
                    }}
                    className={`pb-slot border-2 rounded-[3px] flex items-center justify-center relative overflow-hidden shrink-0 group transition-all duration-200 ${
                      url
                        ? 'bg-zinc-800 border-zinc-500 cursor-pointer hover:border-gray-300 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.45)]'
                        : 'bg-zinc-900/80 border-zinc-600/80 border-dashed cursor-pointer hover:border-zinc-400 hover:bg-zinc-800'
                    } ${
                      dragIndex === index
                        ? 'z-30 scale-[1.12] shadow-2xl ring-2 ring-white/70 border-white/60'
                        : ''
                    } ${
                      overIndex === index && dragIndex !== null && dragIndex !== index
                        ? 'translate-x-[14px] opacity-95'
                        : ''
                    }`}
                    style={{ touchAction: dragIndex === index ? "none" : "auto" }}
                  >
                    {url ? (
                      <>
                        <Image src={url} alt={`${index + 1}`} width={120} height={120} className="w-full h-full object-cover" />
                        {selectedSlot === index && (
                          <div className="absolute inset-0 ring-[3px] ring-inset ring-[#C96442] bg-black/15 pointer-events-none" />
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center text-zinc-500 group-hover:text-gray-300">
                        <span className="text-3xl mb-1">+</span>
                        <span className="text-xs font-semibold text-zinc-200">{dict.home.slotHint}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Горловина: плёнка мягко уходит в корпус брелока */}
          <div
            className="pb-film-throat pb-throat pointer-events-none absolute z-10"
            style={{
              top: '50%',
              transform: 'translateY(-50%)',
              borderTopRightRadius: 28,
              borderBottomRightRadius: 28,
              maskImage: 'linear-gradient(90deg, transparent 0%, #000 28%, #000 100%)',
              WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 28%, #000 100%)',
            }}
          />

          {/* Язычок плёнки — заходит в окно катушки */}
          <div
            className="pb-tongue pointer-events-none absolute z-10"
            style={{
              top: '50%',
              transform: 'translateY(-50%)',
              background: '#1F1E1D',
              borderRadius: '2px 10px 10px 2px',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
          />

          {/* Катушка Kodak — корпус брелока. Высота ≈ 2× ширины плёнки, чтобы читалась как цельный объект */}
          <div
            className="pb-canister pointer-events-none absolute z-20"
            style={{
              top: '50%',
              filter: 'drop-shadow(0 22px 32px rgba(20, 20, 19, 0.32))',
            }}
          >
            <Image
              src="/kodak.png"
              alt="Катушка Kodak — корпус брелока"
              width={379}
              height={658}
              priority
              className="w-full h-full object-contain object-center"
            />
          </div>
        </div>

        {/* Custom scrollbar under the film — swipe still works on the strip */}
        <div
          className="pb-scroll-bar mx-auto"
          role="scrollbar"
          aria-controls="film-scroll"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(scrollThumb.left * 100)}
          aria-label={lang === "ru" ? "Прокрутка ленты" : "Derulare film"}
        >
          <div
            className="pb-scroll-thumb"
            style={{
              width: `${Math.max(12, scrollThumb.width * 100)}%`,
              left: `${scrollThumb.left * 100}%`,
            }}
            onPointerDown={onScrollThumbPointerDown}
          />
        </div>

        {/* Панель управления выделенным кадром — удобные кнопки под палец (44x44px min) */}
        {selectedSlot !== null && slots[selectedSlot] && (
          <div className="mx-auto mt-3 max-w-[420px] rounded-xl border-2 border-[#141413] bg-white px-3 py-2.5 shadow-md">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-[#535146] shrink-0">
                {lang === "ru" ? `Кадр ${selectedSlot + 1}` : `Cadrul ${selectedSlot + 1}`}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => moveSlot(selectedSlot, -1)}
                  disabled={selectedSlot === 0}
                  aria-label={dict.home.moveLeft}
                  className="h-11 w-11 rounded-lg border-2 border-[#141413] bg-white text-[#141413] text-base font-bold disabled:opacity-30 active:bg-[#C96442]/40 flex items-center justify-center shrink-0"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => moveSlot(selectedSlot, 1)}
                  disabled={selectedSlot === MAX_SLOTS - 1}
                  aria-label={dict.home.moveRight}
                  className="h-11 w-11 rounded-lg border-2 border-[#141413] bg-white text-[#141413] text-base font-bold disabled:opacity-30 active:bg-[#C96442]/40 flex items-center justify-center shrink-0"
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={handleReplaceSelected}
                  className="h-11 px-3.5 rounded-lg border-2 border-[#141413] bg-white text-[#141413] text-[13px] font-semibold active:bg-[#C96442]/40 flex items-center justify-center shrink-0"
                >
                  {dict.home.replace}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleRemoveSlot(selectedSlot, e)}
                  className="h-11 px-3.5 rounded-lg border-2 border-[#B42318] bg-[#B42318] text-white text-[13px] font-semibold active:scale-95 flex items-center justify-center shrink-0"
                >
                  {dict.home.remove}
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-[12px] text-[#64635C] mt-3">
          {lang === "ru"
            ? "Плёнка с фото наматывается внутрь катушки — как в настоящем брелоке"
            : "Filmul cu poze se învârte în interiorul casetei — ca la brelocul real"}
        </p>
      </div>

      <div className="max-w-xs sm:max-w-md mx-auto mt-12 px-4">
        {(() => {
          const count = slots.filter(Boolean).length;
          const pct = Math.min(100, (count / 6) * 100);
          return (
            <>
              <div className="text-center mb-3">
                <span className="text-sm text-gray-700 font-medium" aria-live="polite">
                  {lang === "ru"
                    ? count === 0
                      ? "Добавьте от 6 до 10 фото · макет бесплатный"
                      : count < 6
                        ? `Добавлено ${count} из 6 (минимум) · ещё ${6 - count} фото`
                        : count === 10
                          ? "Все 10 фото добавлены · готово к заказу"
                          : `Добавлено ${count} фото · можно оформить или добавить до 10`
                    : count === 0
                      ? "Adaugă de la 6 la 10 poze · macheta e gratuită"
                      : count < 6
                        ? `Adăugate ${count} din 6 (minim) · încă ${6 - count} poze`
                        : count === 10
                          ? "Toate cele 10 poze adăugate · gata de comandă"
                          : `Adăugate ${count} poze · poți comanda sau adăuga până la 10`}
                </span>
                <div
                  className="mt-2 h-1.5 w-full rounded-full bg-[#E9E6DC] overflow-hidden"
                  role="progressbar"
                  aria-valuenow={count}
                  aria-valuemin={0}
                  aria-valuemax={6}
                  aria-label={lang === "ru" ? "Прогресс загрузки фото" : "Progres încărcare poze"}
                >
                  <div
                    className="h-full rounded-full bg-[#C96442] transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (count < 6) {
                    track("builder_start");
                    setActiveSlotIndex(null);
                    fileInputRef.current?.click();
                    return;
                  }
                  track("checkout_start", { photos: count });
                  setTelegramFallback(null);
                  setIsModalOpen(true);
                }}
                className="w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-lg relative z-50 bg-[#C96442] text-[#141413] hover:bg-[#B05730] active:bg-[#D4A000] shadow-[#C96442]/40 flex items-center justify-center min-h-[56px]"
              >
                {count === 0
                  ? (lang === "ru" ? "Выбрать фото (минимум 6)" : "Alege pozele (minim 6)")
                  : count < 6
                    ? (lang === "ru" ? `Добавить ещё ${6 - count} фото (мин. 6)` : `Mai adaugă ${6 - count} poze (min. 6)`)
                    : dict.home.ctaOrder}
              </button>
              {count === 0 && (
                <p className="text-center text-[12px] text-gray-600 mt-2" aria-live="polite">
                  {lang === "ru"
                    ? "Загрузите от 6 до 10 фото через конструктор — макет подготовим бесплатно"
                    : "Încarcă de la 6 la 10 poze prin constructor — pregătim macheta gratuit"}
                </p>
              )}
              {count > 0 && count < 6 && (
                <p className="text-center text-[12px] text-gray-600 mt-2" aria-live="polite">
                  {lang === "ru"
                    ? `Для заказа нужно минимум 6 фото — добавьте ещё ${6 - count}`
                    : `Pentru comandă sunt necesare minim 6 poze — mai adaugă ${6 - count}`}
                </p>
              )}
              {count >= 6 && (
                <p className="text-center text-[12px] text-gray-600 mt-2">
                  {lang === "ru"
                    ? "Макет бесплатно. Платите при получении."
                    : "Machetă gratuită. Plătești la livrare."}
                </p>
              )}
            </>
          );
        })()}
      </div>

      {/* Modals as full-site overlays (React portal → body) */}
      {typeof document !== "undefined" &&
        createPortal(
          <>
            {imageToCrop && (
              <ImageCropper
                key={imageToCrop}
                imageSrc={imageToCrop}
                onCropDone={handleCropDone}
                onSkip={handleCropSkip}
                onCancel={handleCropCancel}
                currentIndex={totalInBatch - cropQueue.length + 1}
                total={totalInBatch}
              />
            )}
            {isModalOpen && (
              <OrderModal
                isOpen={isModalOpen}
                onClose={() => {
                  if (!isSubmitting) setIsModalOpen(false);
                }}
                onSubmit={handleFinalSubmit}
                isSubmitting={isSubmitting}
                uploadProgress={uploadProgress}
              />
            )}
          </>,
          document.body
        )}

      {showError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] max-w-md w-[90%]">
          <div role="alert" className="bg-red-600 text-white px-5 py-4 rounded-2xl shadow-2xl flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-medium">{showError}</span>
              <button onClick={() => { setShowError(null); setTelegramFallback(null); }} className="text-white text-lg font-bold shrink-0 size-11 -mt-2 -mr-2 flex items-center justify-center" aria-label={dict.orderModal.close}>
                ✕
              </button>
            </div>
            {telegramFallback && (
              <a
                href={telegramFallback}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-red-700 font-bold text-sm py-2.5 px-4 hover:bg-red-50"
                onClick={() => track("telegram_click", { source: "error_fallback" })}
              >
                {lang === "ru" ? "Отправить фото в Telegram" : "Trimite pozele pe Telegram"}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
