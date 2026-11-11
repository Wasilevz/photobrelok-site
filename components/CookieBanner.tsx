"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { legalCopy } from "@/lib/legal-copy";
import { useConsent } from "@/lib/consent";

const subscribeNoop = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function Switch({
  checked,
  onChange,
  disabled,
  label,
  id,
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  label: string;
  id: string;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full border-2 border-[#191715] transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#191715] ${
        checked ? "bg-[#FFC400]" : "bg-[#E8E0D0]"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`absolute top-[3px] h-[17px] w-[17px] rounded-full bg-[#191715] transition-transform ${
          checked ? "translate-x-[23px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

export default function CookieBanner() {
  const { lang } = useLanguage();
  const c = legalCopy[lang].banner;
  const legalNav = legalCopy[lang].nav;
  const { decided, acceptAll, acceptNecessary, save } = useConsent();

  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  // Баннер не рендерится на сервере — иначе он мигнёт до чтения сохранённого согласия.
  const mounted = useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerSnapshot);

  if (!mounted || decided) return null;

  return (
    <div
      role="region"
      aria-label={c.title}
      className="fixed inset-x-0 bottom-0 z-[100] px-3 pb-3 sm:px-6 sm:pb-6"
    >
      <div className="mx-auto w-full max-w-3xl max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border-2 border-[#191715] bg-[#FFFDF8] p-3 shadow-[0_-4px_24px_rgba(25,23,21,0.16)] sm:rounded-[20px] sm:p-6">
        <h2 className="sr-only sm:not-sr-only text-[#191715] text-base sm:text-lg font-bold leading-tight">{c.title}</h2>
        <p className="sm:mt-1.5 text-[#5C564E] text-xs sm:text-sm leading-snug sm:leading-relaxed">
          {c.text}{" "}
          <Link
            href="/cookies"
            className="text-[#191715] font-semibold underline underline-offset-2 hover:text-[#E6B000]"
          >
            {legalNav.cookies}
          </Link>
          {!showSettings && (
            <>
              {" · "}
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="text-[#191715] font-semibold underline underline-offset-2 hover:text-[#E6B000]"
              >
                {c.settings}
              </button>
            </>
          )}
        </p>

        {showSettings && (
          <div className="mt-4 space-y-3 rounded-2xl border border-[#E5DCCB] bg-[#F5F1E8] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[#191715] text-sm font-semibold">{c.necessaryLabel}</p>
                <p className="text-[#7A7368] text-xs leading-relaxed mt-0.5">{c.necessaryDesc}</p>
              </div>
              <Switch checked disabled label={c.necessaryLabel} id="consent-necessary" />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[#191715] text-sm font-semibold">{c.analyticsLabel}</p>
                <p className="text-[#7A7368] text-xs leading-relaxed mt-0.5">{c.analyticsDesc}</p>
              </div>
              <Switch
                checked={analytics}
                onChange={setAnalytics}
                label={c.analyticsLabel}
                id="consent-analytics"
              />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[#191715] text-sm font-semibold">{c.marketingLabel}</p>
                <p className="text-[#7A7368] text-xs leading-relaxed mt-0.5">{c.marketingDesc}</p>
              </div>
              <Switch
                checked={marketing}
                onChange={setMarketing}
                label={c.marketingLabel}
                id="consent-marketing"
              />
            </div>
          </div>
        )}

        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:mt-3 sm:flex sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={acceptAll}
            className="min-h-[44px] w-full rounded-xl border-2 border-[#191715] bg-[#FFC400] px-3 sm:px-5 py-2.5 text-[#191715] text-sm font-bold hover:bg-[#E6B000] active:scale-[0.98] transition-all sm:w-auto"
          >
            {c.acceptAll}
          </button>
          <button
            type="button"
            onClick={acceptNecessary}
            className="min-h-[44px] w-full rounded-xl border border-[#D9D0BF] bg-white px-3 sm:px-5 py-2.5 text-[#191715] text-sm font-semibold hover:bg-[#F5F1E8] transition-colors sm:w-auto"
          >
            {c.necessaryOnly}
          </button>
          {showSettings && (
            <button
              type="button"
              onClick={() => save(analytics, marketing)}
              className="col-span-2 min-h-[44px] w-full rounded-xl border border-[#D9D0BF] bg-white px-5 py-2.5 text-[#191715] text-sm font-semibold hover:bg-[#F5F1E8] transition-colors sm:col-span-1 sm:w-auto"
            >
              {c.save}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
