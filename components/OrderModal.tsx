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

type FieldKey = 'name' | 'phone' | 'surname' | 'postalCode' | 'city' | 'district' | 'novaPostBranch' | 'consent';
type Errors = Partial<Record<FieldKey, string>>;

// Порядок совпадает с порядком полей на экране: фокус уходит на первое с ошибкой
const FIELD_ORDER: FieldKey[] = ['name', 'phone', 'surname', 'postalCode', 'district', 'city', 'novaPostBranch', 'consent'];
const FIELD_ID: Record<FieldKey, string> = {
  name: 'customer-name',
  phone: 'customer-phone',
  surname: 'surname',
  postalCode: 'postal-code',
  district: 'district',
  city: 'city',
  novaPostBranch: 'novapost-branch',
  consent: 'consent-data',
};

const inputBase =
  'w-full bg-white border rounded-lg px-4 py-3 text-base text-[#191715] min-h-[48px] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#191715]';
const inputClass = (invalid: boolean) =>
  `${inputBase} ${invalid ? 'border-[#B42318] border-2' : 'border-[#D9D0BF]'}`;

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-[#B42318] text-sm mt-1 flex gap-1.5">
      <span aria-hidden="true">⚠</span>
      <span>{message}</span>
    </p>
  );
}

export default function OrderModal({ isOpen, onClose, onSubmit, isSubmitting, uploadProgress }: OrderModalProps) {
  const { dict, lang } = useLanguage();
  const d = dict.orderModal.delivery;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Самовывоз по умолчанию — форма не требует адреса, конверсия выше
  const [method, setMethod] = useState<DeliveryMethod>('pickup');
  const [surname, setSurname] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [novaPostBranch, setNovaPostBranch] = useState('');

  const [dataConsent, setDataConsent] = useState(false);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  const [errors, setErrors] = useState<Errors>({});

  const dialogRef = useRef<HTMLDialogElement>(null);

  const isDirty =
    name.trim() !== '' || phone.trim() !== '' || surname !== '' || postalCode !== '' ||
    street !== '' || city !== '' || district !== '' || novaPostBranch !== '' ||
    dataConsent || photoConsent || marketingConsent;

  // Закрытие: не во время отправки; если что-то введено — спрашиваем, чтобы не потерять данные
  const requestClose = () => {
    if (isSubmitting) return;
    if (isDirty && !window.confirm(dict.orderModal.unsavedConfirm)) return;
    onClose();
  };
  const requestCloseRef = useRef(requestClose);
  useEffect(() => {
    requestCloseRef.current = requestClose;
  });

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement as HTMLElement | null;
    // showModal(): нативная ловушка фокуса, inert-фон, Escape и возврат на активный элемент
    if (!dialog.open) dialog.showModal();
    // Фокус на заголовок диалога (на мобильных не открываем клавиатуру автоматически)
    const title = dialog.querySelector<HTMLElement>('#order-modal-title');
    title?.focus();

    const onCancel = (e: Event) => {
      e.preventDefault(); // Escape: решаем сами, чтобы не потерять введённое
      requestCloseRef.current();
    };
    dialog.addEventListener('cancel', onCancel);

    // Фон не должен прокручиваться под модалкой — иначе тапы «промахиваются» мимо полей
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      if (dialog.open) dialog.close();
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const clearError = (key: FieldKey) =>
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const phoneProblem = (value: string): string | undefined => {
    if (!value.trim()) return dict.orderModal.phoneRequired;
    const cleaned = value.replace(/[\s\-().]/g, '');
    if (!/^\+?\d{8,15}$/.test(cleaned)) return dict.orderModal.phoneError;
    return undefined;
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (!name.trim()) next.name = dict.orderModal.nameError;
    const pp = phoneProblem(phone);
    if (pp) next.phone = pp;
    if (method === 'posta') {
      if (!surname.trim()) next.surname = d.fieldRequired;
      if (!postalCode.trim()) next.postalCode = d.fieldRequired;
      if (!district.trim()) next.district = d.fieldRequired;
      if (!city.trim()) next.city = d.fieldRequired;
    }
    if (method === 'novapost' && !novaPostBranch.trim()) next.novaPostBranch = d.fieldRequired;
    if (!dataConsent || !photoConsent) next.consent = dict.orderModal.consent.requiredHint;
    return next;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const found = validate();
    setErrors(found);
    const first = FIELD_ORDER.find((k) => found[k]);
    if (first) {
      // Фокус на первое поле с ошибкой: скринридер прочитает её через aria-describedby
      const el = document.getElementById(FIELD_ID[first]);
      el?.focus();
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

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

  const methodCardClass =
    'w-full text-left px-3 py-3 rounded-xl border-2 transition-colors flex items-center justify-between gap-2 min-w-0 min-h-[48px] cursor-pointer border-[#D9D0BF] bg-white hover:border-[#191715] has-[:checked]:border-[#191715] has-[:checked]:bg-[#FFC400]/35 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#191715]';

  const smallInput = (key: FieldKey) => inputClass(!!errors[key]);
  const describedBy = (key: FieldKey, hintId?: string) =>
    [errors[key] ? `${FIELD_ID[key]}-err` : null, hintId ?? null].filter(Boolean).join(' ') || undefined;

  const progressText =
    uploadProgress?.stage === 'finishing'
      ? (lang === 'ru' ? 'Оформляем заказ...' : 'Finalizăm comanda...')
      : uploadProgress && uploadProgress.total > 0
        ? (lang === 'ru'
            ? `Загрузка фото: ${uploadProgress.uploaded} из ${uploadProgress.total}`
            : `Se încarcă pozele: ${uploadProgress.uploaded} din ${uploadProgress.total}`)
        : (lang === 'ru' ? 'Подготовка к отправке...' : 'Pregătire pentru trimitere...');

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="order-modal-title"
      className="m-auto w-[calc(100%-1.5rem)] sm:w-[calc(100%-2rem)] max-w-2xl max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain rounded-2xl border-2 border-[#191715] bg-[#FFFDF8] p-5 sm:p-8 text-[#191715] shadow-2xl backdrop:bg-[#191715]/70"
    >
      <button
        type="button"
        onClick={requestClose}
        className="absolute top-3 right-3 text-[#5C564E] hover:text-[#191715] text-xl font-bold w-11 h-11 flex items-center justify-center rounded-full hover:bg-[#F5F1E8] transition-colors focus-visible:outline-3 focus-visible:outline-[#191715]"
        aria-label={dict.orderModal.close}
      >
        <span aria-hidden="true">✕</span>
      </button>

      <h2 id="order-modal-title" tabIndex={-1} className="text-2xl font-bold text-[#191715] mb-2 pr-10 outline-none">{dict.orderModal.title}</h2>
      <p className="text-[#5C564E] mb-6 text-sm">{dict.orderModal.subtitle}</p>

      {/* noValidate: все проверки и тексты ошибок — наши, на языке интерфейса */}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="customer-name" className="block text-[#3D3832] text-sm mb-1">{dict.orderModal.nameLabel}</label>
            <input
              id="customer-name"
              name="name"
              autoComplete={method === 'posta' ? 'given-name' : 'name'}
              enterKeyHint="next"
              type="text"
              required
              maxLength={60}
              value={name}
              onChange={(e) => { setName(e.target.value); clearError('name'); }}
              aria-invalid={!!errors.name}
              aria-describedby={describedBy('name')}
              className={inputClass(!!errors.name)}
              placeholder={dict.orderModal.namePlaceholder}
            />
            <FieldError id="customer-name-err" message={errors.name} />
          </div>

          <div>
            <label htmlFor="customer-phone" className="block text-[#3D3832] text-sm mb-1">{dict.orderModal.phoneLabel}</label>
            <input
              id="customer-phone"
              name="phone"
              autoComplete="tel"
              inputMode="tel"
              enterKeyHint="next"
              type="tel"
              required
              maxLength={20}
              value={phone}
              onChange={(e) => { setPhone(e.target.value); clearError('phone'); }}
              onBlur={() => {
                if (phone.trim()) setErrors((prev) => ({ ...prev, phone: phoneProblem(phone) }));
              }}
              aria-invalid={!!errors.phone}
              aria-describedby={describedBy('phone', 'customer-phone-hint')}
              className={inputClass(!!errors.phone)}
              placeholder={dict.orderModal.phonePlaceholder}
            />
            <p id="customer-phone-hint" className="text-[#5C564E] text-xs mt-1">{dict.orderModal.phoneHint}</p>
            <FieldError id="customer-phone-err" message={errors.phone} />
          </div>
        </div>

        {/* Способ получения: настоящие радиокнопки в fieldset */}
        <fieldset className="min-w-0 border-0 p-0 m-0">
          <legend className="block text-[#3D3832] text-sm mb-2 p-0">{d.label}</legend>
          <div className="flex flex-col gap-2 sm:grid sm:grid-cols-3 sm:gap-2">
            <label className={`${methodCardClass} sm:col-start-1 sm:row-start-1`}>
              <input type="radio" name="delivery-method" value="posta" checked={method === 'posta'} onChange={() => setMethod('posta')} className="sr-only" />
              <span className="text-[#191715] font-medium text-sm">{d.posta}</span>
              <span className="text-[#5C564E] text-xs text-right">{d.postaPrice}</span>
            </label>

            {method === 'posta' && (
              <div className="pl-1 pr-1 pt-1 pb-2 flex flex-col gap-3 sm:col-span-3 sm:row-start-2">
                <div>
                  <label htmlFor="surname" className="block text-[#5C564E] text-sm mb-1">{d.surnameLabel}</label>
                  <input
                    id="surname"
                    name="surname"
                    autoComplete="family-name"
                    enterKeyHint="next"
                    type="text"
                    required
                    value={surname}
                    onChange={(e) => { setSurname(e.target.value); clearError('surname'); }}
                    aria-invalid={!!errors.surname}
                    aria-describedby={describedBy('surname')}
                    placeholder={d.surnamePlaceholder}
                    className={smallInput('surname')}
                  />
                  <FieldError id="surname-err" message={errors.surname} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="postal-code" className="block text-[#5C564E] text-sm mb-1">{d.postalCodeLabel}</label>
                    <input
                      id="postal-code"
                      name="postalCode"
                      autoComplete="postal-code"
                      enterKeyHint="next"
                      type="text"
                      required
                      value={postalCode}
                      onChange={(e) => { setPostalCode(e.target.value); clearError('postalCode'); }}
                      aria-invalid={!!errors.postalCode}
                      aria-describedby={describedBy('postalCode')}
                      placeholder={d.postalCodePlaceholder}
                      className={smallInput('postalCode')}
                    />
                    <FieldError id="postal-code-err" message={errors.postalCode} />
                  </div>
                  <div>
                    <label htmlFor="district" className="block text-[#5C564E] text-sm mb-1">{d.districtLabel}</label>
                    <input
                      id="district"
                      name="district"
                      autoComplete="address-level1"
                      enterKeyHint="next"
                      type="text"
                      required
                      value={district}
                      onChange={(e) => { setDistrict(e.target.value); clearError('district'); }}
                      aria-invalid={!!errors.district}
                      aria-describedby={describedBy('district')}
                      placeholder={d.districtPlaceholder}
                      className={smallInput('district')}
                    />
                    <FieldError id="district-err" message={errors.district} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="city" className="block text-[#5C564E] text-sm mb-1">{d.cityLabel}</label>
                    <input
                      id="city"
                      name="city"
                      autoComplete="address-level2"
                      enterKeyHint="next"
                      type="text"
                      required
                      value={city}
                      onChange={(e) => { setCity(e.target.value); clearError('city'); }}
                      aria-invalid={!!errors.city}
                      aria-describedby={describedBy('city')}
                      placeholder={d.cityPlaceholder}
                      className={smallInput('city')}
                    />
                    <FieldError id="city-err" message={errors.city} />
                  </div>
                  <div>
                    <label htmlFor="street" className="block text-[#5C564E] text-sm mb-1">{d.streetLabel}</label>
                    <input
                      id="street"
                      name="street"
                      autoComplete="address-line1"
                      enterKeyHint="done"
                      type="text"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder={d.streetPlaceholder}
                      className={inputClass(false)}
                    />
                  </div>
                </div>
              </div>
            )}

            <label className={`${methodCardClass} sm:col-start-2 sm:row-start-1`}>
              <input type="radio" name="delivery-method" value="novapost" checked={method === 'novapost'} onChange={() => setMethod('novapost')} className="sr-only" />
              <span className="text-[#191715] font-medium text-sm">{d.novapost}</span>
              <span className="text-[#5C564E] text-xs text-right">{d.novapostPrice}</span>
            </label>

            {method === 'novapost' && (
              <div className="pl-1 pr-1 pt-1 pb-2 sm:col-span-3 sm:row-start-2">
                <label htmlFor="novapost-branch" className="block text-[#5C564E] text-sm mb-1">{d.branchLabel}</label>
                <input
                  id="novapost-branch"
                  name="novaPostBranch"
                  inputMode="numeric"
                  enterKeyHint="done"
                  type="text"
                  required
                  value={novaPostBranch}
                  onChange={(e) => { setNovaPostBranch(e.target.value); clearError('novaPostBranch'); }}
                  aria-invalid={!!errors.novaPostBranch}
                  aria-describedby={describedBy('novaPostBranch')}
                  placeholder={d.branchPlaceholder}
                  className={smallInput('novaPostBranch')}
                />
                <FieldError id="novapost-branch-err" message={errors.novaPostBranch} />
              </div>
            )}

            <label className={`${methodCardClass} sm:col-start-3 sm:row-start-1`}>
              <input type="radio" name="delivery-method" value="pickup" checked={method === 'pickup'} onChange={() => setMethod('pickup')} className="sr-only" />
              <span className="text-[#191715] font-medium text-sm">{d.pickup}</span>
              <span className="text-[#067647] text-xs text-right font-semibold">{d.pickupPrice}</span>
            </label>

            {method === 'pickup' && (
              <div className="pl-1 pr-1 pt-1 pb-2 text-sm text-[#5C564E] leading-relaxed sm:col-span-3 sm:row-start-2">
                <span aria-hidden="true">📍 </span>{d.pickupAddress}<br />
                <span aria-hidden="true">🕒 </span>{d.pickupHours}
              </div>
            )}
          </div>
        </fieldset>

        <fieldset className="mt-2 rounded-2xl border border-[#E5DCCB] bg-[#F5F1E8] p-4 min-w-0">
          <legend className="sr-only">{lang === 'ru' ? 'Согласия' : 'Acorduri'}</legend>
          <label className="flex items-start gap-3 cursor-pointer min-h-[44px]">
            <input
              id="consent-data"
              type="checkbox"
              required
              checked={dataConsent}
              onChange={(e) => { setDataConsent(e.target.checked); clearError('consent'); }}
              aria-invalid={!!errors.consent && !dataConsent}
              aria-describedby={errors.consent ? 'consent-err' : undefined}
              className="mt-0.5 size-6 shrink-0 accent-[#191715] cursor-pointer"
            />
            <span className="text-sm leading-relaxed text-[#3D3832]">
              {dict.orderModal.consent.dataLabel}
            </span>
          </label>
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-9 inline-flex items-center min-h-[44px] text-sm font-semibold text-[#191715] underline underline-offset-2 hover:text-[#5C564E]"
          >
            {dict.orderModal.consent.dataLink}
          </Link>

          <label className="mt-1 flex items-start gap-3 cursor-pointer min-h-[44px]">
            <input
              id="consent-photo"
              type="checkbox"
              required
              checked={photoConsent}
              onChange={(e) => { setPhotoConsent(e.target.checked); clearError('consent'); }}
              aria-invalid={!!errors.consent && !photoConsent}
              aria-describedby={errors.consent ? 'consent-err' : undefined}
              className="mt-0.5 size-6 shrink-0 accent-[#191715] cursor-pointer"
            />
            <span className="text-sm leading-relaxed text-[#3D3832]">
              {dict.orderModal.consent.photoLabel}
            </span>
          </label>

          <label className="mt-3 flex items-start gap-3 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="mt-0.5 size-6 shrink-0 accent-[#191715] cursor-pointer"
            />
            <span className="text-sm leading-relaxed text-[#5C564E]">
              {dict.orderModal.consent.marketingLabel}
            </span>
          </label>

          <FieldError id="consent-err" message={errors.consent} />
        </fieldset>

        {isSubmitting && (
          <div role="status" aria-live="polite" className="mt-2 p-4 rounded-xl bg-[#F5F1E8] border-2 border-[#191715] flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-sm font-bold text-[#191715]">
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="inline-block size-3.5 rounded-full border-2 border-[#191715] border-t-transparent animate-spin" />
                {progressText}
              </span>
              <span className="text-sm font-bold tabular-nums">
                {uploadProgress && uploadProgress.total > 0
                  ? uploadProgress.stage === 'finishing'
                    ? '100%'
                    : `${Math.min(95, Math.round((uploadProgress.uploaded / uploadProgress.total) * 100))}%`
                  : '...'}
              </span>
            </div>
            <div aria-hidden="true" className="w-full h-3 bg-white rounded-full overflow-hidden border border-[#D9D0BF] p-0.5">
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
            <p className="text-xs text-[#5C564E] text-center leading-tight">
              {lang === 'ru'
                ? 'Пожалуйста, не закрывайте вкладку — фото отправляются на печать'
                : 'Vă rugăm să nu închideți pagina — pozele se trimit pentru tipar'}
            </p>
          </div>
        )}

        {/* Не disabled при невалидной форме: человек видит, чего не хватает, после нажатия.
            Во время отправки блокируем повтор через aria-disabled, фокус при этом не теряется. */}
        <button
          type="submit"
          aria-disabled={isSubmitting}
          className={`mt-2 w-full py-4 rounded-xl font-bold text-lg transition-all min-h-[52px] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#191715] ${
            isSubmitting
              ? "bg-[#E8E0D0] text-[#5C564E] cursor-not-allowed"
              : "bg-[#FFC400] text-[#191715] hover:bg-[#E6B000] border-2 border-[#191715] active:scale-[0.98] shadow-lg shadow-[#FFC400]/35"
          }`}
        >
          {isSubmitting ? (
            <span className="inline-flex items-center justify-center gap-2">
              <span aria-hidden="true" className="inline-block size-4 rounded-full border-2 border-[#5C564E] border-t-transparent animate-spin" />
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
        <p className="text-center text-xs text-[#5C564E] -mt-1">
          {lang === "ru"
            ? "Макет бесплатно · оплата при получении · без предоплат"
            : "Machetă gratuită · plata la livrare · fără avans"}
        </p>
      </form>
    </dialog>
  );
}
