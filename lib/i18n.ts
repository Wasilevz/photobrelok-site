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
    moveLeft: string;
    moveRight: string;
    photoAlreadyAdded: (n: number) => string;
    photosAlreadyAdded: (list: string) => string;
    uploadTruncated: (added: number, total: number) => string;
    draftRestored: (n: number) => string;
    draftClear: string;
  };
  cropper: {
    progress: (cur: number, total: number) => string;
    zoomLow: string;
    zoomHigh: string;
    zoomLabel: string;
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
    nameError: string;
    phoneRequired: string;
    phoneHint: string;
    unsavedConfirm: string;
    secondLabel: string;
    secondHint: string;
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
    consent: {
      dataLabel: string;
      dataLink: string;
      photoNote: string;
      marketingLabel: string;
      requiredHint: string;
    };
  };
  errors: {
    genericSubmit: string;
    unknown: string;
    uploadFailed: string;
    uploadTimeout: string;
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
      title: "Брелок из катушки Kodak с вашими фото | Photobrelok",
      description:
        "6–10 ваших кадров на плёнке в катушке Kodak. Макет бесплатно за 24 часа, брелок за 1–2 дня, оплата при получении.",
    },
    home: {
      title: "Брелок из катушки Kodak с вашими фото",
      subtitle:
        "Загрузите от 6 до 10 любимых фото — мы напечатаем их на плёнке и сделаем уникальный брелок",
      priceLine: (price: number) => `${price} лей · Оплата при получении`,
      slotHint: "+ фото",
      helperEmpty: "Нажмите на кадр → выберите от 6 до 10 фото",
      helperMore: (n: number) => `Ещё ${n} фото до заказа (минимум 6)`,
      helperReady: "Отлично! Минимум 6 фото есть — можно оформить заказ",
      ctaUpload: "Выбрать фото",
      ctaOrder: "Получить бесплатный макет",
      photoCount: (n: number) => `${n}/10 фото`,
      replace: "Заменить",
      remove: "Удалить",
      moveLeft: "Сдвинуть влево",
      moveRight: "Сдвинуть вправо",
      photoAlreadyAdded: (n: number) =>
        `Это фото уже добавлено (кадр ${n}) — выберите другое`,
      photosAlreadyAdded: (list: string) =>
        `Эти фото уже добавлены (кадры ${list}) — пропущены`,
      uploadTruncated: (added: number, total: number) =>
        `Добавлено ${added} из ${total} фото — все слоты заполнены (максимум 10)`,
      draftRestored: (n: number) => `Вернули ваши фото: ${n}`,
      draftClear: "Начать заново",
    },
    cropper: {
      progress: (cur: number, total: number) => `Фото ${cur} из ${total}`,
      zoomLow: "Отдалить",
      zoomHigh: "Приблизить",
      zoomLabel: "Масштаб фото",
      skip: "Не добавлять это фото",
      cancel: "Отмена",
      crop: "Обрезать",
    },
    orderModal: {
      title: "Куда прислать бесплатный макет?",
      subtitle:
        "Оставьте имя и телефон — подготовим макет за 24 часа. Платить сейчас ничего не нужно",
      nameLabel: "Ваше имя",
      namePlaceholder: "Анна",
      phoneLabel: "Номер телефона",
      phonePlaceholder: "60 123 456",
      phoneError: "Проверьте номер: нужно 8–15 цифр, например 60 123 456",
      nameError: "Введите имя, чтобы мы знали, как к вам обращаться",
      phoneRequired: "Введите телефон, мы свяжемся по поводу макета",
      phoneHint: "Например: 60 123 456 или +373 60 123 456",
      unsavedConfirm: "Закрыть форму? Введённые данные будут потеряны.",
      secondLabel: "Добавить второй такой же брелок — +150 лей (−40%)",
      secondHint: "С теми же фото. Доставка одна на весь заказ.",
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
        pickupHours: "Ежедневно с 12:00 до 21:00",
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
      consent: {
        dataLabel:
          "Согласен(на) на обработку персональных данных (имя, телефон, адрес) для оформления и выполнения заказа",
        dataLink: "Политика конфиденциальности",
        photoNote:
          "Отправляя заказ, вы подтверждаете, что имеете право использовать эти фото и люди на них не против.",
        marketingLabel: "Хочу получать новости и специальные предложения",
        requiredHint: "Отметьте согласия, чтобы оформить заказ",
      },
    },
    errors: {
      genericSubmit: "Сбой отправки заказа. Попробуйте ещё раз.",
      unknown: "Неизвестная ошибка",
      uploadFailed: "Не удалось загрузить фото. Попробуйте ещё раз.",
      uploadTimeout: "Загрузка зависла. Проверьте интернет и нажмите ещё раз: уже загруженные фото не пропадут.",
    },
    thanks: {
      orderAccepted: "Заявка",
      accepted: "принята!",
      orderNumber: "Номер:",
      willContact:
        "В течение 24 часов пришлём готовый макет на номер, который вы указали, — в Telegram или по SMS. Мы на связи с 12:00 до 21:00",
      sameOrderBadge: "В том же заказе",
      todayOnly: "Второй брелок",
      upsellTitle1: "Создайте парный комплект!",
      upsellDiscount: "−40%",
      upsellDescPre: "Добавьте второй такой же брелок со скидкой 40% — всего за",
      upsellDescBold: "150 лей вместо 250 лей",
      upsellDescPost: ". Для пары, подруги или себе. Упакуем вместе.",
      regularPrice: "Обычная цена:",
      discountPrice: "Со скидкой:",
      currency: "лей",
      youSave: "Вы экономите",
      saveAmount: "100 лей",
      adding: "Добавляем...",
      addUpsell: "Да, добавить со скидкой",
      noThanks: "Нет, спасибо",
      upsellErrorGeneric:
        "Не получилось оформить добавление. Попробуйте ещё раз — либо просто скажите об этом при звонке.",
      acceptedTitle: "Отличный выбор!",
      acceptedDescLine1: "Мы добавили второй брелок к вашему заказу.",
      acceptedDescLine2: "Вы сэкономили 100 лей!",
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
      title: "Breloc din casetă Kodak cu pozele tale | Photobrelok",
      description:
        "6–10 cadre ale tale pe film într-o casetă Kodak. Machetă gratuită în 24 de ore, breloc în 1–2 zile, plata la primire.",
    },
    home: {
      title: "Breloc din casetă Kodak cu pozele tale",
      subtitle:
        "Încarcă de la 6 la 10 poze preferate — le imprimăm pe film și facem un breloc unic",
      priceLine: (price: number) => `${price} lei · Plată la livrare`,
      slotHint: "+ poză",
      helperEmpty: "Apasă pe cadru → alege de la 6 la 10 poze",
      helperMore: (n: number) => `Încă ${n} poze până la comandă (minim 6)`,
      helperReady: "Perfect! Minim 6 poze încărcate — poți comanda",
      ctaUpload: "Alege pozele",
      ctaOrder: "Primește macheta gratuită",
      photoCount: (n: number) => `${n}/10 poze`,
      replace: "Înlocuiește",
      remove: "Șterge",
      moveLeft: "Mută la stânga",
      moveRight: "Mută la dreapta",
      photoAlreadyAdded: (n: number) =>
        `Această poză e deja adăugată (cadrul ${n}) — alege alta`,
      photosAlreadyAdded: (list: string) =>
        `Aceste poze sunt deja adăugate (cadrurile ${list}) — au fost sărite`,
      uploadTruncated: (added: number, total: number) =>
        `Adăugate ${added} din ${total} poze — toate sloturile sunt ocupate (maxim 10)`,
      draftRestored: (n: number) => `Ți-am păstrat pozele: ${n}`,
      draftClear: "O iau de la capăt",
    },
    cropper: {
      progress: (cur: number, total: number) => `Poza ${cur} din ${total}`,
      zoomLow: "Mai departe",
      zoomHigh: "Mai aproape",
      zoomLabel: "Mărirea pozei",
      skip: "Nu adăuga poza",
      cancel: "Anulează",
      crop: "Decupează",
    },
    orderModal: {
      title: "Unde îți trimitem macheta gratuită?",
      subtitle:
        "Lasă numele și telefonul — pregătim macheta în 24 de ore. Nu plătești nimic acum",
      nameLabel: "Numele tău",
      namePlaceholder: "Ana",
      phoneLabel: "Număr de telefon",
      phonePlaceholder: "069 123 456",
      phoneError: "Verifică numărul: 8–15 cifre, de exemplu 069 123 456",
      nameError: "Introdu numele, ca să știm cum să ne adresăm",
      phoneRequired: "Introdu telefonul, te contactăm pentru machetă",
      phoneHint: "De exemplu: 069 123 456 sau +373 69 123 456",
      unsavedConfirm: "Închizi formularul? Datele introduse se vor pierde.",
      secondLabel: "Adaugă al doilea breloc identic — +150 lei (−40%)",
      secondHint: "Cu aceleași poze. Livrarea e una singură pentru toată comanda.",
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
        pickupHours: "Zilnic, 12:00–21:00",
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
      consent: {
        dataLabel:
          "Sunt de acord cu prelucrarea datelor cu caracter personal (nume, telefon, adresă) pentru întocmirea și executarea comenzii",
        dataLink: "Politica de confidențialitate",
        photoNote:
          "Trimițând comanda, confirmi că ai dreptul să folosești aceste poze și că persoanele din ele sunt de acord.",
        marketingLabel: "Vreau să primesc noutăți și oferte speciale",
        requiredHint: "Bifează acordurile pentru a plasa comanda",
      },
    },
    errors: {
      genericSubmit: "Comanda nu a putut fi trimisă. Încearcă din nou.",
      unknown: "Eroare necunoscută",
      uploadFailed: "Nu s-a putut încărca poza. Încearcă din nou.",
      uploadTimeout: "Încărcarea s-a blocat. Verifică internetul și încearcă din nou: pozele deja încărcate nu se pierd.",
    },
    thanks: {
      orderAccepted: "Cererea",
      accepted: "a fost primită!",
      orderNumber: "Numărul:",
      willContact:
        "În decurs de 24 de ore îți trimitem macheta pe numărul indicat — pe Telegram sau SMS. Suntem online între 12:00 și 21:00",
      sameOrderBadge: "În aceeași comandă",
      todayOnly: "Al doilea breloc",
      upsellTitle1: "Creează un set pentru cuplu!",
      upsellDiscount: "−40%",
      upsellDescPre: "Adaugă un al doilea breloc la fel cu 40% reducere — doar",
      upsellDescBold: "150 lei în loc de 250 lei",
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
