"use client";
import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Package, ArrowRight, Sparkles } from 'lucide-react';
import { useLanguage } from "@/context/LanguageContext";

function readToken(orderId: string): string | undefined {
  try {
    return window.sessionStorage.getItem(`photobrelok_upsell_${orderId}`) || undefined;
  } catch {
    return undefined;
  }
}

function ThankYouContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') || '';
  const { dict } = useLanguage();

  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'pending' | 'accepted' | 'declined'>('pending');
  const [upsellError, setUpsellError] = useState<string | null>(null);

  const handleUpsell = async () => {
    setIsLoading(true);
    setUpsellError(null);
    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, token: readToken(orderId) })
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
    <div className="min-h-screen bg-[#FAF9F5] py-12 px-4 text-[#141413] font-sans">
      <div className="mx-auto w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">

      {/* 1. Блок успеха */}
      <div className="w-full max-w-md lg:max-w-none mx-auto lg:col-start-1 lg:row-start-1 text-center space-y-4 animate-in fade-in slide-in-from-top-4 duration-1000">
        <div className="flex justify-center">
          <div className="relative inline-flex">
            <CheckCircle2 className="w-20 h-20 text-[#141413]" />
            <Sparkles className="absolute -top-2 -right-2 text-[#141413]" />
          </div>
        </div>
        <h1 className="text-4xl font-bold leading-none">
          {dict.thanks.orderAccepted} <span className="text-[#141413] bg-[#C96442] px-2 rounded-lg">{dict.thanks.accepted}</span>
        </h1>
        <p className="text-[#535146] font-medium">
          {dict.thanks.orderNumber} <span className="text-black bg-zinc-200 px-2 py-1 rounded font-mono">#{orderId}</span>
        </p>
        <p className="text-[#64635C] text-sm">
          {dict.thanks.willContact}
        </p>
      </div>

      {/* 2. Оффер-апселл — без таймера и ложной срочности */}
      {status === 'pending' ? (
        <div className="w-full max-w-md lg:max-w-none lg:col-start-2 lg:row-start-1 lg:row-span-3 bg-[#FFFFFF] border-[3px] border-[#141413] rounded-[40px] p-8 shadow-2xl relative overflow-hidden animate-in zoom-in duration-700">
          <div className="absolute top-0 right-0 bg-[#C96442] text-[#141413] px-6 py-2 rounded-bl-3xl font-black text-xs uppercase tracking-widest">
            {dict.thanks.sameOrderBadge}
          </div>

          <div className="mb-4">
            <span className="inline-block bg-[#C96442]/25 text-[#141413] text-xs font-bold px-3 py-1 rounded-full uppercase bg-[#C96442]">
              {dict.thanks.todayOnly}
            </span>
          </div>

          <h2 className="text-2xl font-black leading-[1.1] mb-4">
            {dict.thanks.upsellTitle1}<br />
            <span className="text-[#A84D2A]">{dict.thanks.upsellDiscount}</span>
          </h2>

          <p className="text-[#3D3929] mb-6 leading-relaxed text-sm">
            {dict.thanks.upsellDescPre} <span className="font-bold text-black">{dict.thanks.upsellDescBold}</span> {dict.thanks.upsellDescPost}
          </p>

          <div className="space-y-3 mb-6 bg-[#F6E9E2] p-5 rounded-3xl border border-[#E6C4B4]">
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#535146]">{dict.thanks.regularPrice}</span>
              <span className="font-bold line-through text-[#64635C]">250 {dict.thanks.currency}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-bold text-black">{dict.thanks.discountPrice}</span>
              <span className="text-3xl font-black text-[#A84D2A]">150 {dict.thanks.currency}</span>
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
            className="w-full py-5 bg-[#C96442] hover:bg-[#B05730] text-[#141413] font-black rounded-2xl shadow-xl transition-all duration-300 flex items-center justify-center gap-3 group active:scale-[0.98] disabled:opacity-70 shadow-[#C96442]/40"
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
            className="w-full mt-4 py-4 bg-white border border-[#DAD9D4] hover:bg-[#FAF9F5] text-[#141413] font-bold rounded-xl transition-colors text-sm"
          >
            {dict.thanks.noThanks}
          </button>
        </div>
      ) : status === 'accepted' ? (
        <div className="w-full max-w-md lg:max-w-none lg:col-start-2 lg:row-start-1 lg:row-span-3 bg-[#141413] text-[#FAF9F5] rounded-[40px] p-10 text-center animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-[#C96442]/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="w-10 h-10 text-[#C96442]" />
          </div>
          <h2 className="text-2xl font-black uppercase">{dict.thanks.acceptedTitle}</h2>
          <p className="text-[#B7B5A9] mt-3">{dict.thanks.acceptedDescLine1} <br />{dict.thanks.acceptedDescLine2}</p>
        </div>
      ) : (
        <div className="w-full max-w-md lg:max-w-none lg:col-start-2 lg:row-start-1 lg:row-span-3 bg-[#FFFFFF] border border-[#DAD9D4] rounded-[40px] p-8 text-center">
          <div className="w-16 h-16 bg-[#FAF9F5] rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-[#B7B5A9]" />
          </div>
          <h2 className="text-xl font-bold">{dict.thanks.neutralTitle}</h2>
          <p className="text-[#64635C] mt-2 text-sm">{dict.thanks.neutralDeclined}</p>
        </div>
      )}

      {/* Инфо */}
      <div className="w-full max-w-md lg:max-w-none mx-auto lg:col-start-1 lg:row-start-2 lg:mt-0 mt-8 space-y-3">
        <div className="bg-[#FFFFFF] p-4 rounded-2xl flex items-center gap-3 border border-[#DAD9D4] shadow-sm">
          <div className="w-10 h-10 bg-[#F6E9E2] rounded-xl flex items-center justify-center text-[#C96442]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm">{dict.thanks.paymentTitle}</h4>
            <p className="text-xs text-[#64635C]">{dict.thanks.paymentSub}</p>
          </div>
        </div>
      </div>

      <button
        onClick={() => router.push('/')}
        className="w-full max-w-md lg:max-w-none mx-auto lg:col-start-1 lg:row-start-3 lg:mt-0 mt-8 py-4 bg-white border-2 border-gray-200 text-[#3D3929] font-bold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2"
      >
        {dict.thanks.backToSite}
      </button>
      </div>
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
