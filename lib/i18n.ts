export type Locale = "ru" | "ro";
export type DeliveryMethod = "posta" | "novapost" | "pickup" | "later";

export interface Dict {
  meta: {
    title: string;
    description: string;
  };
  home: {
    title: string;
    subtitle: string;
    priceLine: (price: number) => string;
    slotHint: string;
    helperEmpty: string;
    helperMore: (n: number) => string;
    helperReady: string;
    ctaUpload: string;
    ctaOrder: string;
    photoCount: (n: number) => string;
    replace: string;
    remove: string;
    uploadTruncated: (added: number, total: number) => string;
  };
  cropper: {
    progress: (cur: number, total: number) => string;
    zoomLow: string;
    zoomHigh: string;
    skip: string;
    cancel: string;
    crop: string;
  };
  orderModal: {
    title: string;
    subtitle: string;
    nameLabel: string;
    namePlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    phoneError: string;
    submitting: string;
    submit: string;
    close: string;
    delivery: {
      label: string;
      posta: string;
      postaPrice: string;
      novapost: string;
      novapostPrice: string;
      pickup: string;
      pickupPrice: string;
      pickupAddress: string;
      pickupHours: string;
      later: string;
      laterHint: string;
      postalCodeLabel: string;
      postalCodePlaceholder: string;
      surnameLabel: string;
      surnamePlaceholder: string;
      streetLabel: string;
      streetPlaceholder: string;
      cityLabel: string;
      cityPlaceholder: string;
      districtLabel: string;
      districtPlaceholder: string;
      branchLabel: string;
      branchPlaceholder: string;
      fieldRequired: string;
      chooseMethod: string;
    };
  };
  errors: {
    genericSubmit: string;
    unknown: string;
    uploadFailed: string;
  };
  thanks: {
    orderAccepted: string;
    accepted: string;
    orderNumber: string;
    willContact: string;
    sameOrderBadge: string;
    todayOnly: string;
    upsellTitle1: string;
    upsellDiscount: string;
    upsellDescPre: string;
    upsellDescBold: string;
    upsellDescPost: string;
    regularPrice: string;
    discountPrice: string;
    currency: string;
    youSave: string;
    saveAmount: string;
    adding: string;
    addUpsell: string;
    noThanks: string;
    upsellErrorGeneric: string;
    acceptedTitle: string;
    acceptedDescLine1: string;
    acceptedDescLine2: string;
    neutralTitle: string;
    neutralExpired: string;
    neutralDeclined: string;
    paymentTitle: string;
    paymentSub: string;
    backToSite: string;
  };
}

export const translations: Record<Locale, Dict> = {
  ru: {
    meta: {
      title: "Фото-брелок из ваших фотографий | Photobrelok",
      description:
        "Загрузите любимые фото и получите уникальный брелок с мини-фотографиями. Оплата при получении.",
    },
    home: {
      title: "Фото-брелок своими руками",
      subtitle:
        "Загрузите от 6 до 10 любимых фото — мы напечатаем их на плёнке и сделаем уникальный брелок",
      priceLine: (price: number) => `${price} лей · Оплата при получении`,
      slotHint: "+ фото",
      helperEmpty: "Нажмите на кадр → можно выбрать сразу несколько фото",
      helperMore: (n: number) => `Ещё ${n} фото, чтобы собрать плёнку`,
      helperReady: "Отлично! Можно отправить на макет",
      ctaUpload: "Выбрать фото",
      ctaOrder: "Получить бесплатный макет",
      photoCount: (n: number) => `${n}/10 фото`,
      replace: "Заменить",
      remove: "Удалить",
      uploadTruncated: (added: number, total: number) =>
        `Добавлено ${added} из ${total} фото — все слоты заполнены (максимум 10)`,
    },
    cropper: {
      progress: (cur: number, total: number) => `Фото ${cur} из ${total}`,
      zoomLow: "Мало",
      zoomHigh: "Много",
      skip: "Пропустить",
      cancel: "Отмена",
      crop: "Обрезать",
    },
    orderModal: {
      title: "Куда прислать бесплатный макет?",
      subtitle:
        "Оставьте имя и телефон — подготовим PDF-макет за 24 часа. Платить сейчас ничего не нужно",
      nameLabel: "Ваше имя",
      namePlaceholder: "Николай",
      phoneLabel: "Номер телефона",
      phonePlaceholder: "60 123 456",
      phoneError: "Формат: 60 123 456",
      submitting: "Отправка...",
      submit: "Получить бесплатный макет",
      close: "Закрыть",
      delivery: {
        label: "Способ получения",
        posta: "Poșta Moldovei",
        postaPrice: "30 лей · 2–4 дня",
        novapost: "Nova Poshta",
        novapostPrice: "60 лей · 2–3 дня",
        pickup: "Самовывоз",
        pickupPrice: "Бесплатно",
        pickupAddress: "ул. A. Bernardazzi 64, Кишинёв",
        pickupHours: "Ежедневно с 09:00 до 23:00",
        later: "Уточню позже",
        laterHint: "Способ получения согласуем после макета — без обязательств",
        postalCodeLabel: "Почтовый индекс",
        postalCodePlaceholder: "MD-2001",
        surnameLabel: "Фамилия (нужна для почты)",
        surnamePlaceholder: "Гергич",
        streetLabel: "Улица (если есть)",
        streetPlaceholder: "ул. Штефан чел Маре, 10",
        cityLabel: "Город или село",
        cityPlaceholder: "Кишинёв",
        districtLabel: "Район",
        districtPlaceholder: "Например, Единецкий",
        branchLabel: "Номер отделения Nova Poshta",
        branchPlaceholder: "Например, 25",
        fieldRequired: "Заполните это поле",
        chooseMethod: "Выберите способ получения",
      },
    },
    errors: {
      genericSubmit: "Сбой отправки заказа. Попробуйте ещё раз.",
      unknown: "Неизвестная ошибка",
      uploadFailed: "Не удалось загрузить фото. Попробуйте ещё раз.",
    },
    thanks: {
      orderAccepted: "Заявка",
      accepted: "принята!",
      orderNumber: "Номер:",
      willContact:
        "В течение 24 часов пришлём готовый PDF-макет на согласование в Telegram или по SMS. Мы на связи с 09:00 до 23:00",
      sameOrderBadge: "В том же заказе",
      todayOnly: "Второй брелок",
      upsellTitle1: "Создайте парный комплект!",
      upsellDiscount: "−40%",
      upsellDescPre: "Добавьте второй такой же брелок со скидкой 40% — всего за",
      upsellDescBold: "150 MDL вместо 250 MDL",
      upsellDescPost: ". Для пары, подруги или себе. Упакуем вместе.",
      regularPrice: "Обычная цена:",
      discountPrice: "Со скидкой:",
      currency: "лей",
      youSave: "Вы экономите",
      saveAmount: "100 леев",
      adding: "Добавляем...",
      addUpsell: "Да, добавить со скидкой",
      noThanks: "Нет, спасибо",
      upsellErrorGeneric:
        "Не получилось оформить добавление. Попробуйте ещё раз — либо просто скажите об этом при звонке.",
      acceptedTitle: "Отличный выбор!",
      acceptedDescLine1: "Мы добавили второй брелок к вашему заказу.",
      acceptedDescLine2: "Сэкономили 100 леев!",
      neutralTitle: "Хорошо, увидимся!",
      neutralExpired:
        "Предложение по второму брелоку больше не активно, но ваша заявка уже у нас в работе.",
      neutralDeclined: "Ваша заявка уже у нас в работе — менеджер пришлёт макет.",
      paymentTitle: "Оплата при получении",
      paymentSub: "Никаких предоплат",
      backToSite: "← Вернуться на сайт",
    },
  },
  ro: {
    meta: {
      title: "Breloc foto personalizat | Photobrelok",
      description:
        "Încarcă pozele preferate și primești un breloc unic cu mini-fotografii. Plată la livrare.",
    },
    home: {
      title: "Breloc foto personalizat",
      subtitle:
        "Încarcă de la 6 la 10 poze preferate — le imprimăm pe film și facem un breloc unic",
      priceLine: (price: number) => `${price} lei · Plată la livrare`,
      slotHint: "+ poză",
      helperEmpty: "Apasă pe cadru → poți alege mai multe poze deodată",
      helperMore: (n: number) => `Încă ${n} poze până la comandă`,
      helperReady: "Perfect! Poți plasa comanda",
      ctaUpload: "Alege pozele",
      ctaOrder: "Primește macheta gratuită",
      photoCount: (n: number) => `${n}/10 poze`,
      replace: "Înlocuiește",
      remove: "Șterge",
      uploadTruncated: (added: number, total: number) =>
        `Adăugate ${added} din ${total} poze — toate sloturile sunt ocupate (maxim 10)`,
    },
    cropper: {
      progress: (cur: number, total: number) => `Poza ${cur} din ${total}`,
      zoomLow: "Puțin",
      zoomHigh: "Mult",
      skip: "Sari peste",
      cancel: "Anulează",
      crop: "Decupează",
    },
    orderModal: {
      title: "Unde îți trimitem macheta gratuită?",
      subtitle:
        "Lasă numele și telefonul — pregătim macheta PDF în 24 de ore. Nu plătești nimic acum",
      nameLabel: "Numele tău",
      namePlaceholder: "Ion",
      phoneLabel: "Număr de telefon",
      phonePlaceholder: "069 123 456",
      phoneError: "Format: 069 123 456",
      submitting: "Se trimite...",
      submit: "Primește macheta gratuită",
      close: "Închide",
      delivery: {
        label: "Metoda de livrare",
        posta: "Poșta Moldovei",
        postaPrice: "30 lei · 2–4 zile",
        novapost: "Nova Poshta",
        novapostPrice: "60 lei · 2–3 zile",
        pickup: "Ridicare personală",
        pickupPrice: "Gratuit",
        pickupAddress: "str. A. Bernardazzi 64, Chișinău",
        pickupHours: "Zilnic, 09:00–23:00",
        later: "Spun mai târziu",
        laterHint: "Metoda o stabilim după machetă — fără obligații",
        postalCodeLabel: "Cod poștal",
        postalCodePlaceholder: "MD-2001",
        surnameLabel: "Numele de familie (necesar pentru poștă)",
        surnamePlaceholder: "Popescu",
        streetLabel: "Stradă (dacă există)",
        streetPlaceholder: "str. Ștefan cel Mare, 10",
        cityLabel: "Oraș sau sat",
        cityPlaceholder: "Chișinău",
        districtLabel: "Raion",
        districtPlaceholder: "De exemplu, Edineț",
        branchLabel: "Numărul filialei Nova Poshta",
        branchPlaceholder: "De exemplu, 25",
        fieldRequired: "Completează acest câmp",
        chooseMethod: "Alege metoda de livrare",
      },
    },
    errors: {
      genericSubmit: "Comanda nu a putut fi trimisă. Încearcă din nou.",
      unknown: "Eroare necunoscută",
      uploadFailed: "Nu s-a putut încărca poza. Încearcă din nou.",
    },
    thanks: {
      orderAccepted: "Cererea",
      accepted: "a fost primită!",
      orderNumber: "Numărul:",
      willContact:
        "În decurs de 24 de ore îți trimitem macheta PDF pe Telegram sau SMS. Suntem online între 09:00 și 23:00",
      sameOrderBadge: "În aceeași comandă",
      todayOnly: "Al doilea breloc",
      upsellTitle1: "Creează un set pentru cuplu!",
      upsellDiscount: "−40%",
      upsellDescPre: "Adaugă un al doilea breloc la fel cu 40% reducere — doar",
      upsellDescBold: "150 MDL în loc de 250 MDL",
      upsellDescPost: ". Pentru voi doi, o prietenă sau pentru tine. Le împachetăm împreună.",
      regularPrice: "Preț obișnuit:",
      discountPrice: "Cu reducere:",
      currency: "lei",
      youSave: "Economisești",
      saveAmount: "100 lei",
      adding: "Se adaugă...",
      addUpsell: "Da, adaugă cu reducere",
      noThanks: "Nu, mulțumesc",
      upsellErrorGeneric:
        "Adăugarea nu a reușit. Încearcă din nou — sau spune-ne la telefon.",
      acceptedTitle: "Alegere excelentă!",
      acceptedDescLine1: "Am adăugat al doilea breloc la comanda ta.",
      acceptedDescLine2: "Ai economisit 100 lei!",
      neutralTitle: "Bine, pe curând!",
      neutralExpired:
        "Oferta pentru al doilea breloc nu mai e activă, dar cererea ta e deja în lucru.",
      neutralDeclined: "Cererea ta e deja în lucru — managerul îți trimite macheta.",
      paymentTitle: "Plată la livrare",
      paymentSub: "Fără avans",
      backToSite: "← Înapoi la site",
    },
  },
};
