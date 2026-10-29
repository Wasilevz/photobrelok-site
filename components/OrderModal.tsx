import React, { useState, useEffect, useRef } from 'react';
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

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; phone: string; delivery: DeliveryData }) => void;
  isSubmitting: boolean;
}

export default function OrderModal({ isOpen, onClose, onSubmit, isSubmitting }: OrderModalProps) {
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

  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      nameRef.current?.focus();
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
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
    !isSubmitting && name.trim() !== '' && phone.trim() !== '' && isDeliveryValid();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDeliveryTouched(true);
    if (!name.trim()) {
      setNameError(dict.orderModal.delivery.fieldRequired);
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

    onSubmit({ name: fullName, phone: phone.trim(), delivery });
  };

  const methodCardClass = (m: DeliveryMethod) =>
    `w-full text-left px-3 py-3 rounded-xl border-2 transition-colors flex items-center justify-between gap-2 min-w-0 ${
      method === m
        ? 'border-[#191715] bg-[#FFC400]/35'
        : 'border-[#D9D0BF] bg-white hover:border-[#191715]'
    }`;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#191715]/70 p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-[#FFFDF8] border-2 border-[#191715] rounded-2xl p-8 w-full max-w-2xl shadow-2xl relative my-8"
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
                      className="w-full bg-white border border-[#D9D0BF] rounded-lg px-3 py-2.5 text-[#191715] text-sm focus:outline-none focus:border-[#FFC400] focus:ring-1 focus:ring-[#FFC400]"
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
                        className="w-full bg-white border border-[#D9D0BF] rounded-lg px-3 py-2.5 text-[#191715] text-sm focus:outline-none focus:border-[#FFC400] focus:ring-1 focus:ring-[#FFC400]"
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
                        className="w-full bg-white border border-[#D9D0BF] rounded-lg px-3 py-2.5 text-[#191715] text-sm focus:outline-none focus:border-[#FFC400] focus:ring-1 focus:ring-[#FFC400]"
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
                      className="w-full bg-white border border-[#D9D0BF] rounded-lg px-3 py-2.5 text-[#191715] text-sm focus:outline-none focus:border-[#FFC400] focus:ring-1 focus:ring-[#FFC400]"
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
                      className="w-full bg-white border border-[#D9D0BF] rounded-lg px-3 py-2.5 text-[#191715] text-sm focus:outline-none focus:border-[#FFC400] focus:ring-1 focus:ring-[#FFC400]"
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
                    className="w-full bg-white border border-[#D9D0BF] rounded-lg px-3 py-2.5 text-[#191715] text-sm focus:outline-none focus:border-[#FFC400] focus:ring-1 focus:ring-[#FFC400]"
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

          <button
            type="submit"
            disabled={!canSubmit}
              className={`mt-2 w-full py-4 rounded-xl font-bold text-lg transition-all min-h-[52px] ${
                !canSubmit
                  ? "bg-[#E8E0D0] text-[#7A7368] cursor-not-allowed"
                  : "bg-[#FFC400] text-[#191715] hover:bg-[#E6B000] border-2 border-[#191715] active:scale-[0.98] shadow-lg shadow-[#FFC400]/35"
              }`}
          >
            {isSubmitting ? dict.orderModal.submitting : dict.orderModal.submit}
          </button>
          <p className="text-center text-[12px] text-[#7A7368] -mt-1">
            {lang === "ru"
              ? "Макет бесплатно · оплата при получении · без предоплат"
              : "Machetă gratuită · plata la livrare · fără avans"}
          </p>
        </form>
      </div>
    </div>
  );
}
