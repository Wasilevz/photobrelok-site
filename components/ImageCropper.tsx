"use client";

import React, { useState, useCallback, useEffect } from "react";
import Cropper from "react-easy-crop";
import { Area } from "react-easy-crop";
import getCroppedImg from "../utils/cropImage";
import { useLanguage } from "@/context/LanguageContext";

interface ImageCropperProps {
  imageSrc: string;
  onCropDone: (croppedImageUrl: string) => void;
  onSkip?: () => void;
  onCancel: () => void;
  currentIndex?: number;
  total?: number;
}

export default function ImageCropper({ imageSrc, onCropDone, onSkip, onCancel, currentIndex, total }: ImageCropperProps) {
  const { dict } = useLanguage();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);
  const isBatch = total !== undefined && total > 1 && !!onSkip;

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // В пачке Escape = пропустить текущий кадр, не сбрасывать всю очередь
      if (isBatch) onSkip?.();
      else onCancel();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onCancel, onSkip, isBatch]);

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCrop = async () => {
    if (!croppedAreaPixels) return;

    setIsProcessing(true);
    setCropError(null);
    try {
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (croppedImageBlob) {
        const croppedImageUrl = URL.createObjectURL(croppedImageBlob);
        onCropDone(croppedImageUrl);
      }
    } catch (e) {
      console.error("Ошибка при обрезке:", e);
      setCropError(dict.errors.unknown);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col bg-black" style={{ height: "100dvh" }}>
      <div className="relative flex-1 min-h-0 w-full">
        {total !== undefined && total > 1 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-black/70 text-white text-xs font-medium px-3 py-1.5 rounded-full">
            {dict.cropper.progress(currentIndex ?? 1, total)}
          </div>
        )}
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          onCropChange={setCrop}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
        />
      </div>

      <div
        className="bg-zinc-900 px-4 py-4 sm:p-6 flex flex-col items-center gap-3 sm:gap-4 flex-none"
        style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="w-full max-w-md">
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>{dict.cropper.zoomLow}</span>
            <span>{dict.cropper.zoomHigh}</span>
          </div>
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.1}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-white"
          />
        </div>

        {cropError && (
          <p className="w-full max-w-md text-red-400 text-xs text-center" role="alert">
            {cropError}
          </p>
        )}

        <div className="flex gap-4 w-full max-w-md">
          <button
            onClick={() => (isBatch ? onSkip?.() : onCancel())}
            disabled={isProcessing}
            className="flex-1 py-3 px-4 bg-white/10 text-white rounded-lg font-semibold hover:bg-white/20 transition-colors disabled:opacity-60 border-2 border-white/80"
          >
            {isBatch ? dict.cropper.skip : dict.cropper.cancel}
          </button>
          <button
            onClick={handleCrop}
            disabled={isProcessing || !croppedAreaPixels}
            className="flex-1 py-3 px-4 bg-white text-black rounded-lg font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              dict.cropper.crop
            )}
          </button>
        </div>
      </div>
    </div>
  );
}