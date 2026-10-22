"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import ImageCropper from "@/components/ImageCropper";
import OrderModal from "@/components/OrderModal";
import type { DeliveryData } from "@/components/OrderModal";
import { useRouter } from 'next/navigation';
import { useLanguage } from "@/context/LanguageContext";
import { useOccasion } from "@/lib/occasion-store";

export default function PhotoConstructor() {
  const router = useRouter();
  const { lang, dict } = useLanguage();
  const { occasion } = useOccasion();
  const [slots, setSlots] = useState<(string | null)[]>(Array(10).fill(null));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const longPressRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showError, setShowError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Батч-загрузка: очередь фото, ожидающих обрезки, каждое привязано к своему слоту
  const [cropQueue, setCropQueue] = useState<{ url: string; slotIndex: number }[]>([]);
  const [totalInBatch, setTotalInBatch] = useState(0);
  const imageToCrop = cropQueue[0]?.url ?? null;

  const revokeOldUrl = useCallback((url: string | null) => {
    if (url && url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  }, []);

  useEffect(() => {
    handleCarouselScroll();
  }, []);

  const handleSlotClick = (index: number) => {
    setActiveSlotIndex(index);
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);

    // Слот, на который кликнули, заполняется первым (даже если уже занят — это "заменить")
    const targetIndices: number[] = [];
    if (activeSlotIndex !== null) targetIndices.push(activeSlotIndex);

    // Остальные фото уходят в следующие свободные слоты по порядку
    for (let i = 0; i < slots.length && targetIndices.length < fileArray.length; i++) {
      if (i === activeSlotIndex) continue;
      if (!slots[i]) targetIndices.push(i);
    }

    const queue = fileArray.slice(0, targetIndices.length).map((file, i) => ({
      url: URL.createObjectURL(file),
      slotIndex: targetIndices[i],
    }));

    if (fileArray.length > targetIndices.length) {
      setShowError(dict.home.uploadTruncated(queue.length, fileArray.length));
    }

    setCropQueue(queue);
    setTotalInBatch(queue.length);
    e.target.value = "";
  };

  const handleCropDone = (croppedImageUrl: string) => {
    const current = cropQueue[0];
    if (current) {
      setSlots((prev) => {
        const newSlots = [...prev];
        revokeOldUrl(newSlots[current.slotIndex]);
        newSlots[current.slotIndex] = croppedImageUrl;
        return newSlots;
      });
    }
    const rest = cropQueue.slice(1);
    setCropQueue(rest);
    if (rest.length === 0) setTotalInBatch(0);
  };

  // --- ОБНОВЛЕННАЯ ФУНКЦИЯ ОТМЕНЫ (Очистка памяти) ---
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
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  const scrollCarousel = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === 'left' ? -240 : 240, behavior: 'smooth' });
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

  const startLongPress = (index: number) => {
    if (!slots[index]) return;
    clearLongPress();
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
      setSlots((prev) => {
        const next = [...prev];
        const [item] = next.splice(dragIndex, 1);
        next.splice(overIndex, 0, item ?? null);
        while (next.length < 10) next.push(null);
        return next.slice(0, 10);
      });
      vibrate(25);
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
  };

  const handleFinalSubmit = async (userData: { name: string; phone: string; delivery: DeliveryData }) => {
    setIsSubmitting(true);
    try {
      const photoUrls: string[] = [];

      for (const blobUrl of slots) {
        if (!blobUrl) continue;
        const res = await fetch(blobUrl);
        const blob = await res.blob();

        const formData = new FormData();
        formData.append("file", blob, `photo_${Date.now()}.jpg`);
        formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);

        const cloudRes = await fetch(
          `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
          { method: "POST", body: formData }
        );
        const data = await cloudRes.json();

        if (!cloudRes.ok) throw new Error(dict.errors.uploadFailed);
        photoUrls.push(data.secure_url);
      }

      const apiRes = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userData.name,
          phone: userData.phone,
          photoUrls,
          lang,
          delivery: userData.delivery,
        }),
      });

      if (!apiRes.ok) {
        const errData = await apiRes.json().catch(() => null);
        throw new Error(errData?.error || dict.errors.genericSubmit);
      }

      const { orderId } = await apiRes.json();

      slots.forEach(revokeOldUrl);
      setSlots(Array(10).fill(null));
      setIsModalOpen(false);
      router.push(`/thanks?orderId=${orderId}`);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : dict.errors.unknown;
      setShowError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="constructor" className="bg-[#F5F1E8] text-[#191715] py-10 font-sans selection:bg-white/40">
      
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

      {/* Film strip + Kodak: side-by-side so the strip never runs under the canister */}
      <div className="relative w-full max-w-5xl mx-auto mt-8 px-2 sm:px-4">
        {canScrollLeft && (
          <button
            onClick={() => scrollCarousel('left')}
            aria-label={lang === 'ru' ? 'Прокрутить влево' : 'Derulează la stânga'}
            className="absolute left-4 top-2 z-[60] w-9 h-9 rounded-full bg-black/70 hover:bg-black/90 text-white text-lg flex items-center justify-center shadow-lg transition-colors"
          >
            ‹
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scrollCarousel('right')}
            aria-label={lang === 'ru' ? 'Прокрутить вправо' : 'Derulează la dreapta'}
            className="absolute right-[120px] sm:right-[150px] top-2 z-[60] w-9 h-9 rounded-full bg-black/70 hover:bg-black/90 text-white text-lg flex items-center justify-center shadow-lg transition-colors animate-pulse"
          >
            ›
          </button>
        )}

        <div className="relative">
          {/* Film always runs under the canister; last frame stops before it */}
          <div
            ref={scrollContainerRef}
            className="w-full h-[150px] sm:h-[168px] overflow-x-auto flex items-center no-scrollbar"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', overscrollBehaviorX: 'contain' }}
            onScroll={handleCarouselScroll}
          >
            <style>{`
              .no-scrollbar::-webkit-scrollbar { display: none !important; }
            `}</style>

            <div className="relative bg-[#111] h-[150px] sm:h-[168px] flex items-center rounded-l-[42px] pl-[56px] sm:pl-[64px] gap-[10px] shrink-0 pr-[110px] sm:pr-[130px] min-w-full overflow-hidden" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2218%22 height=%2211%22%3E%3Crect x=%222%22 y=%221%22 width=%228%22 height=%229%22 rx=%222.2%22 fill=%22%23f0ebe1%22/%3E%3C/svg%3E"), url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2218%22 height=%2211%22%3E%3Crect x=%222%22 y=%221%22 width=%228%22 height=%229%22 rx=%222.2%22 fill=%22%23f0ebe1%22/%3E%3C/svg%3E")', backgroundSize: '18px 11px, 18px 11px', backgroundPosition: '0 9px, 0 calc(100% - 9px)', backgroundRepeat: 'repeat-x, repeat-x' }}>

              <div className="absolute left-[14px] top-1/2 -translate-y-1/2 w-[38px] h-[38px] z-10 rounded-full overflow-hidden pointer-events-none">
                <Image
                  src="/ring.png"
                  alt=""
                  width={38}
                  height={38}
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="flex gap-[10px] z-10 ml-3 relative pr-2">
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
                      startLongPress(index);
                    }}
                    onPointerMove={(e) => {
                      if (!draggingRef.current && longPressRef.current !== null) {
                        // cancel long-press if finger moves too much before drag starts
                        // (simple: keep timer; drag after threshold starts anyway)
                      }
                      moveDragTarget(e.clientX, e.clientY);
                    }}
                    onPointerUp={finishDrag}
                    onPointerCancel={finishDrag}
                    onPointerLeave={() => {
                      if (!draggingRef.current) clearLongPress();
                    }}
                    className={`w-[104px] h-[104px] sm:w-[116px] sm:h-[116px] border-2 border-dashed rounded-md flex items-center justify-center relative overflow-hidden shrink-0 group transition-all duration-200 ${
                      url
                        ? 'bg-zinc-800 border-zinc-600 cursor-pointer hover:border-gray-400'
                        : 'bg-zinc-800 border-zinc-600 cursor-pointer hover:border-zinc-400 hover:bg-zinc-700'
                    } ${
                      dragIndex === index
                        ? 'z-30 scale-[1.18] shadow-2xl ring-2 ring-white/70 border-white/60'
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
                        <Image src={url} alt={`${index + 1}`} width={116} height={116} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-1">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleSlotClick(index); }}
                            className="w-[90%] bg-white text-black text-[11px] font-semibold px-1 py-1.5 rounded-md shadow hover:bg-gray-100"
                          >
                            {dict.home.replace}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleRemoveSlot(index, e)}
                            className="w-[90%] bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold px-1 py-1.5 rounded-md shadow"
                          >
                            {dict.home.remove}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center text-zinc-500 group-hover:text-gray-300">
                        <span className="text-3xl mb-1">+</span>
                        <span className="text-[11px] font-semibold text-zinc-200">{dict.home.slotHint}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Dark end-cap: film visually continues under the canister */}
          <div
            className="absolute right-0 w-[120px] sm:w-[136px] h-[150px] sm:h-[168px] bg-[#111] pointer-events-none z-10"
            style={{ top: "50%", transform: "translateY(-50%)" }}
          />

          {/* Canister covers the film end completely */}
          <div
            className="absolute right-[-20px] sm:right-[-28px] w-[150px] sm:w-[172px] h-[220px] sm:h-[236px] pointer-events-none z-20 flex items-center justify-center"
            style={{ top: "50%", transform: "translateY(-50%)" }}
          >
            <Image
              src="/kodak.png"
              alt="Катушка Kodak — корпус брелока"
              width={379}
              height={658}
              className="w-full h-full object-contain object-center drop-shadow-md pointer-events-none"
            />
          </div>
        </div>
      </div>

      <div className="max-w-xs sm:max-w-md mx-auto mt-12 px-4">
        <div className="text-center mb-3">
          <span className="text-sm text-gray-700 font-medium" aria-live="polite">
            {`${slots.filter(Boolean).length} из 6 · можно до 10`}
            {slots.filter(Boolean).length > 0 && slots.filter(Boolean).length < 6
              ? ` · ещё ${6 - slots.filter(Boolean).length}`
              : ""}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            if (slots.filter(Boolean).length < 6) {
              fileInputRef.current?.click();
            } else {
              setIsModalOpen(true);
            }
          }}
          className="w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-lg relative z-50 bg-[#FFC400] text-[#191715] hover:bg-[#E6B000] active:bg-[#D4A000] shadow-[#FFC400]/40"
        >
          {slots.filter(Boolean).length < 6
            ? dict.home.ctaUpload
            : dict.home.ctaOrder}
        </button>
        {slots.filter(Boolean).length < 6 && (
          <p className="text-center text-[12px] text-gray-600 mt-2" aria-live="polite">
            {lang === "ru"
              ? `Добавьте ещё ${6 - slots.filter(Boolean).length} фото — и можно отправлять на макет`
              : `Mai adaugă ${6 - slots.filter(Boolean).length} poze — apoi trimiți pentru machetă`}
          </p>
        )}
        <p className="text-center text-[12px] text-gray-600 mt-2">
          {lang === "ru"
            ? "Макет бесплатно. Платите при получении."
            : "Machetă gratuită. Plătești la livrare."}
        </p>
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
                onCancel={handleCropCancel}
                currentIndex={totalInBatch - cropQueue.length + 1}
                total={totalInBatch}
              />
            )}
            {isModalOpen && (
              <OrderModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleFinalSubmit}
                isSubmitting={isSubmitting}
              />
            )}
          </>,
          document.body
        )}

      {showError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] max-w-md w-[90%]">
          <div className="bg-red-600 text-white px-5 py-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{showError}</span>
            <button onClick={() => setShowError(null)} className="text-white/70 hover:text-white text-lg font-bold shrink-0">
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
