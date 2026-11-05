import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useLanguage } from "@/context/LanguageContext";
import { DeliveryMethod } from "@/lib/i18n";

export interface DeliveryData {
  method: DeliveryMethod;
  surname?: string;
  postalCode?: string;
  street?: string;
  city?: string;
  district?: string;
  novaPostBranch?: string;
}

export interface UploadProgress {
  uploaded: number;
  total: number;
  stage: 'uploading' | 'finishing';
}

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; phone: string; delivery: DeliveryData; marketingConsent: boolean }) => void;
  isSubmitting: boolean;
  uploadProgress?: UploadProgress | null;
}

export default function OrderModal({ isOpen, onClose, onSubmit, isSubmitting, uploadProgress }: OrderModalProps) {
  const { dict, lang } = useLanguage();
  const d = dict.orderModal.delivery;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [nameError, setNameError] = useState('');

  // Самовывоз по умолчанию — форма не требует адреса, конверсия выше
  const [method, setMethod] = useState<DeliveryMethod>('pickup');
  const [surname, setSurname] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [novaPostBranch, setNovaPostBranch] = useState('');
  const [deliveryTouched, setDeliveryTouched] = useState(false);

  const [dataConsent, setDataConsent] = useState(false);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Автофокус только на десктопе: на мобилке клавиатура сразу перекрывает поля формы
      const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
      if (!isCoarsePointer) nameRef.current?.focus();
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEscape);
      // Фон не должен прокручиваться под модалкой — иначе тапы «промахиваются» мимо полей
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const validatePhone = (value: string): boolean => {
    const cleaned = value.replace(/[\s\-().]/g, '');
    if (!/^\+?\d{8,15}$/.test(cleaned)) {
      setPhoneError(dict.orderModal.phoneError);
      return false;
    }
    setPhoneError('');
    return true;
  };

  const selectMethod = (m: DeliveryMethod) => {
    setMethod(m);
    setDeliveryTouched(true);
  };

  const isDeliveryValid = (): boolean => {
    if (method === 'posta') return surname.trim() !== '' && postalCode.trim() !== '' && city.trim() !== '' && district.trim() !== '';
    if (method === 'novapost') return novaPostBranch.trim() !== '';
    // pickup и later — без обязательных полей
    return true;
  };

  const canSubmit =
    !isSubmitting && name.trim() !== '' && phone.trim() !== '' && isDeliveryValid() && dataConsent && photoConsent;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDeliveryTouched(true);
    if (!dataConsent || !photoConsent) {
      setConsentError(true);
      consentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setConsentError(false);
    if (!name.trim()) {
      setNameError(dict.orderModal.delivery.fieldRequired);
      nameRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setNameError('');
    if (!validatePhone(phone)) return;
    if (!isDeliveryValid()) return;

    const delivery: DeliveryData =
      method === 'posta'
        ? { method, surname: surname.trim(), postalCode: postalCode.trim(), street: street.trim(), city: city.trim(), district: district.trim() }
        : method === 'novapost'
          ? { method, novaPostBranch: novaPostBranch.trim() }
          : { method };

    const fullName = method === 'posta' && surname.trim()
      ? `${name.trim()} ${surname.trim()}`
      : name.trim();

    onSubmit({ name: fullName, phone: phone.trim(), delivery, marketingConsent });
  };

  const methodCardClass = (m: DeliveryMethod) =>
    `w-full text-left px-3 py-3 rounded-xl border-2 transition-colors flex items-center justify-between gap-2 min-w-0 ${
      method === m
        ? 'border-[#191715] bg-[#FFC400]/35'
        : 'border-[#D9D0BF] bg-white hover:border-[#191715]'
    }`;

  return (
    <div className="fixed inset-0 z-[10000] overflow-y-auto overscroll-contain bg-[#191715]/70" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        <div
          className="bg-[#FFFDF8] border-2 border-[#191715] rounded-2xl p-5 sm:p-8 w-full max-w-2xl shadow-2xl relative my-auto"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-modal-title"
        >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-[#7A7368] hover:text-[#191715] text-xl font-bold w-11 h-11 flex items-center justify-center rounded-full hover:bg-[#F5F1E8] transition-colors"
          aria-label={dict.orderModal.close}
        >
          ✕
        </button>

        <h2 id="order-modal-title" className="text-2xl font-bold text-[#191715] mb-2">{dict.orderModal.title}</h2>
        <p className="text-[#5C564E] mb-6 text-sm">{dict.orderModal.subtitle}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="customer-name" className="block text-[#3D3832] text-sm mb-1">{dict.orderModal.nameLabel}</label>
            <input
              id="customer-name"
              name="name"
              autoComplete="name"
              ref={nameRef}
              type="text"
              required
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(''); }}
              onBlur={() => {
                if (!name.trim()) setNameError(dict.orderModal.delivery.fieldRequired);
              }}
              aria-invalid={!!nameError}
              className={`w-full bg-white border rounded-lg px-4 py-3 text-[#191715] focus:outline-none focus:ring-1 ${
                nameError
                  ? 'border-[#B42318] focus:border-[#B42318] focus:ring-[#B42318]'
                  : 'border-[#D9D0BF] focus:border-[#FFC400] focus:ring-[#FFC400]'
              }`}
              placeholder={dict.orderModal.namePlaceholder}
            />
            {nameError && (
              <p className="text-[#B42318] text-xs mt-1">{nameError}</p>
            )}
          </div>

          <div>
            <label htmlFor="customer-phone" className="block text-[#3D3832] text-sm mb-1">{dict.orderModal.phoneLabel}</label>
            <input
              id="customer-phone"
              name="phone"
              autoComplete="tel"
              inputMode="tel"
              type="tel"
              required
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setPhoneError(''); }}
              onBlur={() => phone && validatePhone(phone)}
              className={`w-full bg-white border rounded-lg px-4 py-3 text-[#191715] focus:outline-none focus:ring-1 ${
                phoneError
                  ? 'border-[#B42318] focus:border-[#B42318] focus:ring-[#B42318]'
                  : 'border-[#D9D0BF] focus:border-[#191715] focus:ring-[#FFC400]'
              }`}
              placeholder={dict.orderModal.phonePlaceholder}
            />
            {phoneError && (
              <p className="text-[#B42318] text-xs mt-1">{phoneError}</p>
            )}
          </div>
          </div>

          {/* Способ получения */}
          <div>
            <label className="block text-[#3D3832] text-sm mb-2">{d.label}</label>
            <div className="flex flex-col gap-2 sm:grid sm:grid-cols-3 sm:gap-2">
              <button type="button" onClick={() => selectMethod('posta')} className={`${methodCardClass('posta')} sm:col-start-1 sm:row-start-1`}>
                <span className="text-[#191715] font-medium text-sm">{d.posta}</span>
                <span className="text-[#7A7368] text-xs text-right">{d.postaPrice}</span>
              </button>

              {method === 'posta' && (
                <div className="pl-1 pr-1 pt-1 pb-2 flex flex-col gap-3 relative z-10 pointer-events-auto sm:col-span-3 sm:row-start-2">
                  <div>
                    <label htmlFor="surname" className="block text-[#5C564E] text-xs mb-1">{d.surnameLabel}</label>
                    <input
                      id="surname"
                      name="surname"
                      autoComplete="family-name"
                      type="text"
                      value={surname}
                      onChange={(e) => setSurname(e.target.value)}
                      placeholder={d.surnamePlaceholder}
                      className="w-full bg-white border border-[#D9D0BF] rounded-lg px-3 py-2.5 text-[#191715] text-base focus:outline-none focus:border-[#FFC400] focus:ring-1 focus:ring-[#FFC400]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="postal-code" className="block text-[#5C564E] text-xs mb-1">{d.postalCodeLabel}</label>
                      <input
                        id="postal-code"
                        name="postalCode"
                        autoComplete="postal-code"
                        inputMode="numeric"
                        type="text"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        placeholder={d.postalCodePlaceholder}
                        className="w-full bg-white border border-[#D9D0BF] rounded-lg px-3 py-2.5 text-[#191715] text-base focus:outline-none focus:border-[#FFC400] focus:ring-1 focus:ring-[#FFC400]"
                      />
                    </div>
                    <div>
                      <label htmlFor="district" className="block text-[#5C564E] text-xs mb-1">{d.districtLabel}</label>
                      <input
                        id="district"
                        name="district"
                        type="text"
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        placeholder={d.districtPlaceholder}
                        className="w-full bg-white border border-[#D9D0BF] rounded-lg px-3 py-2.5 text-[#191715] text-base focus:outline-none focus:border-[#FFC400] focus:ring-1 focus:ring-[#FFC400]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="city" className="block text-[#5C564E] text-xs mb-1">{d.cityLabel}</label>
                    <input
                      id="city"
                      name="city"
                      autoComplete="address-level2"
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder={d.cityPlaceholder}
                      className="w-full bg-white border border-[#D9D0BF] rounded-lg px-3 py-2.5 text-[#191715] text-base focus:outline-none focus:border-[#FFC400] focus:ring-1 focus:ring-[#FFC400]"
                    />
                  </div>
                  <div>
                    <label htmlFor="street" className="block text-[#5C564E] text-xs mb-1">{d.streetLabel}</label>
                    <input
                      id="street"
                      name="street"
                      autoComplete="street-address"
                      type="text"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder={d.streetPlaceholder}
                      className="w-full bg-white border border-[#D9D0BF] rounded-lg px-3 py-2.5 text-[#191715] text-base focus:outline-none focus:border-[#FFC400] focus:ring-1 focus:ring-[#FFC400]"
                    />
                  </div>
                  </div>
                </div>
              )}

              <button type="button" onClick={() => selectMethod('novapost')} className={`${methodCardClass('novapost')} sm:col-start-2 sm:row-start-1`}>
                <span className="text-[#191715] font-medium text-sm">{d.novapost}</span>
                <span className="text-[#7A7368] text-xs text-right">{d.novapostPrice}</span>
              </button>

              {method === 'novapost' && (
                <div className="pl-1 pr-1 pt-1 pb-2 animate-in fade-in duration-200 sm:col-span-3 sm:row-start-2">
                  <label htmlFor="novapost-branch" className="block text-[#5C564E] text-xs mb-1">{d.branchLabel}</label>
                  <input
                    id="novapost-branch"
                    name="novaPostBranch"
                    inputMode="numeric"
                    type="text"
                    value={novaPostBranch}
                    onChange={(e) => setNovaPostBranch(e.target.value)}
                    placeholder={d.branchPlaceholder}
                    className="w-full bg-white border border-[#D9D0BF] rounded-lg px-3 py-2.5 text-[#191715] text-base focus:outline-none focus:border-[#FFC400] focus:ring-1 focus:ring-[#FFC400]"
                  />
                </div>
              )}

              <button type="button" onClick={() => selectMethod('pickup')} className={`${methodCardClass('pickup')} sm:col-start-3 sm:row-start-1`}>
                <span className="text-[#191715] font-medium text-sm">{d.pickup}</span>
                <span className="text-[#067647] text-xs text-right font-semibold">{d.pickupPrice}</span>
              </button>

              {method === 'pickup' && (
                <div className="pl-1 pr-1 pt-1 pb-2 text-xs text-[#5C564E] leading-relaxed animate-in fade-in duration-200 sm:col-span-3 sm:row-start-2">
                  📍 {d.pickupAddress}<br />
                  🕒 {d.pickupHours}
                </div>
              )}
            </div>
            {deliveryTouched && !isDeliveryValid() && method === 'posta' && (
              <p className="text-[#B42318] text-xs mt-2">{d.fieldRequired}</p>
            )}
            {deliveryTouched && !isDeliveryValid() && method === 'novapost' && (
              <p className="text-[#B42318] text-xs mt-2">{d.fieldRequired}</p>
            )}
          </div>

          <div ref={consentRef} className="mt-2 rounded-2xl border border-[#E5DCCB] bg-[#F5F1E8] p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={dataConsent}
                onChange={(e) => {
                  setDataConsent(e.target.checked);
                  setConsentError(false);
                }}
                className="mt-0.5 size-5 shrink-0 accent-[#191715] cursor-pointer"
              />
              <span className="text-[13px] leading-relaxed text-[#3D3832]">
                {dict.orderModal.consent.dataLabel}
              </span>
            </label>
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-8 mt-1 inline-block min-h-[24px] text-[12px] font-semibold text-[#191715] underline underline-offset-2 hover:text-[#E6B000]"
            >
              {dict.orderModal.consent.dataLink}
            </Link>

            <label className="mt-3 flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={photoConsent}
                onChange={(e) => {
                  setPhotoConsent(e.target.checked);
                  setConsentError(false);
                }}
                className="mt-0.5 size-5 shrink-0 accent-[#191715] cursor-pointer"
              />
              <span className="text-[13px] leading-relaxed text-[#3D3832]">
                {dict.orderModal.consent.photoLabel}
              </span>
            </label>

            <label className="mt-3 flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className="mt-0.5 size-5 shrink-0 accent-[#191715] cursor-pointer"
              />
              <span className="text-[13px] leading-relaxed text-[#5C564E]">
                {dict.orderModal.consent.marketingLabel}
              </span>
            </label>

            {consentError && (
              <p className="mt-2 text-[#B42318] text-xs">{dict.orderModal.consent.requiredHint}</p>
            )}
          </div>

          {isSubmitting && (
            <div className="mt-2 p-4 rounded-xl bg-[#F5F1E8] border-2 border-[#191715] flex flex-col gap-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs font-bold text-[#191715]">
                <span className="flex items-center gap-2">
                  <span className="inline-block size-3.5 rounded-full border-2 border-[#191715] border-t-transparent animate-spin" />
                  {uploadProgress?.stage === 'finishing'
                    ? (lang === 'ru' ? 'Оформляем заказ...' : 'Finalizăm comanda...')
                    : uploadProgress && uploadProgress.total > 0
                      ? (lang === 'ru'
                          ? `Загрузка фото: ${uploadProgress.uploaded} из ${uploadProgress.total}`
                          : `Se încarcă pozele: ${uploadProgress.uploaded} din ${uploadProgress.total}`)
                      : (lang === 'ru' ? 'Подготовка к отправке...' : 'Pregătire pentru trimitere...')}
                </span>
                <span className="text-xs font-bold tabular-nums">
                  {uploadProgress && uploadProgress.total > 0
                    ? uploadProgress.stage === 'finishing'
                      ? '100%'
                      : `${Math.min(95, Math.round((uploadProgress.uploaded / uploadProgress.total) * 100))}%`
                    : '...'}
                </span>
              </div>
              <div className="w-full h-3 bg-white rounded-full overflow-hidden border border-[#D9D0BF] p-0.5">
                <div
                  className="h-full bg-[#FFC400] rounded-full transition-all duration-300 ease-out"
                  style={{
                    width: `${
                      uploadProgress && uploadProgress.total > 0
                        ? uploadProgress.stage === 'finishing'
                          ? 100
                          : Math.max(8, Math.min(95, Math.round((uploadProgress.uploaded / uploadProgress.total) * 100)))
                        : 15
                    }%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-[#7A7368] text-center leading-tight">
                {lang === 'ru'
                  ? 'Пожалуйста, не закрывайте вкладку — фото отправляются на печать'
                  : 'Vă rugăm să nu închideți pagina — pozele se trimit pentru tipar'}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className={`mt-2 w-full py-4 rounded-xl font-bold text-lg transition-all min-h-[52px] ${
              !canSubmit || isSubmitting
                ? "bg-[#E8E0D0] text-[#7A7368] cursor-not-allowed"
                : "bg-[#FFC400] text-[#191715] hover:bg-[#E6B000] border-2 border-[#191715] active:scale-[0.98] shadow-lg shadow-[#FFC400]/35"
            }`}
          >
            {isSubmitting ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="inline-block size-4 rounded-full border-2 border-[#7A7368] border-t-transparent animate-spin" />
                {uploadProgress?.stage === 'finishing'
                  ? (lang === 'ru' ? 'Оформляем...' : 'Finalizăm...')
                  : uploadProgress && uploadProgress.total > 0
                    ? (lang === 'ru'
                        ? `Загружено ${uploadProgress.uploaded} из ${uploadProgress.total}`
                        : `Încărcat ${uploadProgress.uploaded} din ${uploadProgress.total}`)
                    : dict.orderModal.submitting}
              </span>
            ) : (
              dict.orderModal.submit
            )}
          </button>
          <p className="text-center text-[12px] text-[#7A7368] -mt-1">
            {lang === "ru"
              ? "Макет бесплатно · оплата при получении · без предоплат"
              : "Machetă gratuită · plata la livrare · fără avans"}
          </p>
        </form>
        </div>
      </div>
    </div>
  );
}
