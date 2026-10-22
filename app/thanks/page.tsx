"use client";
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Timer, Package, ArrowRight, Sparkles } from 'lucide-react';
import { useLanguage } from "@/context/LanguageContext";

function ThankYouContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') || '';
  const { dict } = useLanguage();

  const [timeLeft, setTimeLeft] = useState(600);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'pending' | 'accepted' | 'declined' | 'expired'>('pending');
  const [upsellError, setUpsellError] = useState<string | null>(null);
  const timeLeftRef = useRef(timeLeft);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (timeLeftRef.current <= 0) {
        clearInterval(interval);
        return;
      }
      setTimeLeft(prev => {
        const next = prev - 1;
        if (next <= 0) {
          setStatus((s) => (s === 'pending' ? 'expired' : s));
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleUpsell = async () => {
    setIsLoading(true);
    setUpsellError(null);
    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `🔥 <b>АПСЕЛЛ! Заказ #${orderId}</b>\nКлиент добавил ВТОРОЙ брелок (-40%).\nПоложите 2 шт. в посылку.`
        })
      });
      if (!res.ok) throw new Error('Не получилось передать менеджеру');
      setStatus('accepted');
    } catch (error) {
      console.error("Ошибка:", error);
      setUpsellError(dict.thanks.upsellErrorGeneric);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F1E8] flex flex-col items-center py-12 px-4 text-[#191715] font-sans">

      {/* 1. Блок успеха */}
      <div className="max-w-md w-full text-center space-y-4 mb-8 animate-in fade-in slide-in-from-top-4 duration-1000">
        <div className="flex justify-center relative">
          <CheckCircle2 className="w-20 h-20 text-[#191715]" />
          <Sparkles className="absolute -top-2 -right-2 text-[#191715]" />
        </div>
        <h1 className="text-4xl font-bold leading-none">
          {dict.thanks.orderAccepted} <span className="text-[#191715] bg-[#FFC400] px-2 rounded-lg">{dict.thanks.accepted}</span>
        </h1>
        <p className="text-[#5C564E] font-medium">
          {dict.thanks.orderNumber} <span className="text-black bg-zinc-200 px-2 py-1 rounded font-mono">#{orderId}</span>
        </p>
        <p className="text-[#7A7368] text-sm">
          {dict.thanks.willContact}
        </p>
      </div>

      {/* 2. Оффер-апселл */}
      {status === 'pending' ? (
        <div className="max-w-md w-full bg-[#FFFDF8] border-[3px] border-[#191715] rounded-[40px] p-8 shadow-2xl relative overflow-hidden animate-in zoom-in duration-700">
          <div className="absolute top-0 right-0 bg-[#FFC400] text-white px-6 py-2 rounded-bl-3xl font-black text-xs uppercase tracking-widest">
            {dict.thanks.sameOrderBadge}
          </div>

          <div className="mb-4">
            <span className="inline-block bg-[#FFC400]/25 text-[#191715] text-xs font-bold px-3 py-1 rounded-full uppercase bg-[#FFC400]">
              {dict.thanks.todayOnly}
            </span>
          </div>

          <h2 className="text-2xl font-black leading-[1.1] mb-4">
            {dict.thanks.upsellTitle1}<br />
            <span className="text-[#FFC400]">{dict.thanks.upsellDiscount}</span>
          </h2>

          <p className="text-[#3D3832] mb-6 leading-relaxed text-sm">
            {dict.thanks.upsellDescPre} <span className="font-bold text-black">{dict.thanks.upsellDescBold}</span> {dict.thanks.upsellDescPost}
          </p>

          <div className="space-y-3 mb-6 bg-[#FFF6D6] p-5 rounded-3xl border border-[#E8D48A]">
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#5C564E]">{dict.thanks.regularPrice}</span>
              <span className="font-bold line-through text-[#7A7368]">250 {dict.thanks.currency}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-bold text-black">{dict.thanks.discountPrice}</span>
              <span className="text-3xl font-black text-[#FFC400]">150 {dict.thanks.currency}</span>
            </div>
          </div>

          <div className="flex items-center justify-between mb-6 px-2">
            <div className="flex items-center gap-2 text-[#FFC400] font-mono font-bold text-2xl">
              <Timer className="w-6 h-6" />
              {formatTime(timeLeft)}
            </div>
            <div className="text-right leading-none">
              <div className="text-[10px] font-black uppercase text-[#7A7368]">{dict.thanks.youSave}</div>
              <div className="text-lg font-black text-[#191715]">{dict.thanks.saveAmount}</div>
            </div>
          </div>

          {upsellError && (
            <p className="text-red-600 text-xs text-center mb-4 bg-red-50 rounded-lg py-2 px-3">
              {upsellError}
            </p>
          )}

          <button
            onClick={handleUpsell}
            disabled={isLoading}
            className="w-full py-5 bg-[#FFC400] hover:bg-[#E6B000] text-[#191715] font-black rounded-2xl shadow-xl transition-all duration-300 flex items-center justify-center gap-3 group active:scale-[0.98] disabled:opacity-70 shadow-[#FFC400]/40"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {dict.thanks.adding}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                {dict.thanks.addUpsell}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            )}
          </button>

          <button
            onClick={() => setStatus('declined')}
            className="w-full mt-4 py-4 bg-white border border-[#D9D0BF] hover:bg-[#F5F1E8] text-[#191715] font-bold rounded-xl transition-colors text-sm"
          >
            {dict.thanks.noThanks}
          </button>
        </div>
      ) : status === 'accepted' ? (
        <div className="max-w-md w-full bg-[#191715] text-[#F5F1E8] rounded-[40px] p-10 text-center animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-[#FFC400]/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="w-10 h-10 text-[#FFC400]" />
          </div>
          <h2 className="text-2xl font-black uppercase">{dict.thanks.acceptedTitle}</h2>
          <p className="text-[#B8B0A4] mt-3">{dict.thanks.acceptedDescLine1} <br />{dict.thanks.acceptedDescLine2}</p>
        </div>
      ) : (
        <div className="max-w-md w-full bg-[#FFFDF8] border border-[#D9D0BF] rounded-[40px] p-8 text-center">
          <div className="w-16 h-16 bg-[#F5F1E8] rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-[#B8B0A4]" />
          </div>
          <h2 className="text-xl font-bold">{dict.thanks.neutralTitle}</h2>
          <p className="text-[#7A7368] mt-2 text-sm">
            {status === 'expired'
              ? dict.thanks.neutralExpired
              : dict.thanks.neutralDeclined}
          </p>
        </div>
      )}

      {/* Инфо */}
      <div className="max-w-md w-full mt-8 space-y-3">
        <div className="bg-[#FFFDF8] p-4 rounded-2xl flex items-center gap-3 border border-[#E5DCCB] shadow-sm">
          <div className="w-10 h-10 bg-[#FFF6D6] rounded-xl flex items-center justify-center text-[#FFC400]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm">{dict.thanks.paymentTitle}</h4>
            <p className="text-xs text-[#7A7368]">{dict.thanks.paymentSub}</p>
          </div>
        </div>
      </div>

      <button
        onClick={() => router.push('/')}
        className="mt-8 w-full max-w-md py-4 bg-white border-2 border-gray-200 text-[#3D3832] font-bold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2"
      >
        {dict.thanks.backToSite}
      </button>
    </div>
  );
}

export default function ThankYouPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">...</div>}>
      <ThankYouContent />
    </Suspense>
  );
}
