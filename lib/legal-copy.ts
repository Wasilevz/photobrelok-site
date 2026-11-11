export type LegalLocale = "ru" | "ro";

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  list?: string[];
  table?: { head: string[]; rows: string[][] };
  /** Абзацы после списка или таблицы. */
  after?: string[];
}

export interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

export interface LegalCopy {
  privacy: LegalDoc;
  cookies: LegalDoc;
  banner: {
    title: string;
    text: string;
    acceptAll: string;
    necessaryOnly: string;
    settings: string;
    settingsTitle: string;
    necessaryLabel: string;
    necessaryDesc: string;
    analyticsLabel: string;
    analyticsDesc: string;
    marketingLabel: string;
    marketingDesc: string;
    save: string;
  };
  nav: {
    backToSite: string;
    privacy: string;
    cookies: string;
    updatedPrefix: string;
  };
  contactLine: string;
}

export const legalCopy: Record<LegalLocale, LegalCopy> = {
  ru: {
    contactLine:
      "По вопросам обработки персональных данных используйте контакты, указанные в разделе «Контакты» на сайте.",
    nav: {
      backToSite: "Вернуться на сайт",
      privacy: "Политика конфиденциальности",
      cookies: "Политика cookie",
      updatedPrefix: "Редакция от",
    },
    banner: {
      title: "Мы используем cookie",
      text: "Необходимые cookie обеспечивают работу сайта. Аналитика и реклама включаются только с вашего согласия. Подробнее — в политике cookie.",
      acceptAll: "Принять все",
      necessaryOnly: "Только необходимые",
      settings: "Настроить",
      settingsTitle: "Настройки cookie",
      necessaryLabel: "Необходимые",
      necessaryDesc: "Работа сайта, язык, запоминание вашего выбора. Отключить нельзя.",
      analyticsLabel: "Аналитика",
      analyticsDesc: "Помогает понять, как пользуются сайтом, чтобы улучшать его.",
      marketingLabel: "Маркетинг",
      marketingDesc: "Реклама и измерение её эффективности (пиксель Meta).",
      save: "Сохранить выбор",
    },
    privacy: {
      title: "Политика конфиденциальности",
      updated: "29 октября 2026",
      intro:
        "Эта политика объясняет, какие персональные данные собирает сервис PHOTOBRELOK, зачем они нужны, кому передаются и как вы можете ими управлять. Пользуясь сайтом и оформляя заказ, вы подтверждаете, что ознакомились с этой политикой.",
      sections: [
        {
          heading: "1. Кто мы",
          paragraphs: [
            "PHOTOBRELOK (далее — «мы», «Сервис») — сервис, который изготавливает заказанные вами изделия по вашим материалам.",
            "Мы определяем цели и способы обработки ваших персональных данных и выступаем оператором (контролёром) данных в смысле применимого законодательства о защите персональных данных. Если вы находитесь в ЕС/ЕЭЗ, мы также выступаем контролёром по смыслу GDPR.",
            "По всем вопросам обработки персональных данных обращайтесь через контакты, указанные в разделе «Контакты» на сайте.",
          ],
        },
        {
          heading: "2. Какие данные мы обрабатываем",
          table: {
            head: ["Данные", "Зачем нужны"],
            rows: [
              ["Имя", "Оформление заказа, обращение к вам, подготовка макета"],
              ["Номер телефона", "Связь по заказу, уточнение деталей, доставка"],
              [
                "Адрес доставки: индекс, населённый пункт, район, улица",
                "Только при выборе доставки курьером или почтой",
              ],
              [
                "Файлы и изображения, которые вы загружаете",
                "Изготовление заказанного товара или услуги",
              ],
              [
                "Язык интерфейса и другие настройки",
                "Хранятся в вашем браузере (localStorage) и не передаются нам",
              ],
              [
                "IP-адрес, тип браузера, источник перехода",
                "Работа сайта, защита от злоупотреблений, а с вашего согласия — аналитика и реклама",
              ],
            ],
          },
        },
        {
          heading: "3. Зачем и на каком основании",
          table: {
            head: ["Цель", "Основание"],
            rows: [
              [
                "Оформление и выполнение заказа, изготовление товара",
                "Ваше согласие при оформлении заказа и действия по договору",
              ],
              ["Связь по заказу, уточнение деталей", "Выполнение договора"],
              ["Доставка заказа", "Выполнение договора"],
              ["Аналитика использования сайта", "Ваше отдельное согласие через баннер cookie"],
              ["Реклама и измерение её эффективности", "Ваше отдельное согласие через баннер cookie"],
              ["Обеспечение безопасности и предотвращение мошенничества", "Законный интерес"],
            ],
          },
        },
        {
          heading: "4. Материалы, которые вы загружаете",
          paragraphs: [
            "Загружайте только те файлы и изображения, на использование которых у вас есть право и согласие изображённых на них лиц.",
            "Мы используем загруженные материалы исключительно для подготовки заказа и его изготовления. Мы не публикуем их, не используем в рекламе и не показываем другим клиентам. Единственное исключение — необходимость показать вам результат на согласование и передать файл в производство.",
          ],
        },
        {
          heading: "5. Кому передаются данные",
          paragraphs: [
            "Передача третьим лицам ограничена тем, что необходимо для работы сервиса.",
          ],
          table: {
            head: ["Категория получателя", "Что передаём", "Зачем"],
            rows: [
              [
                "Облачное хранилище файлов",
                "Загруженные вами файлы",
                "Временное хранение для подготовки и изготовления заказа",
              ],
              [
                "Мессенджер или CRM для обработки заказов",
                "Имя, телефон, адрес, файл заказа",
                "Передача заказа в рабочий канал производства",
              ],
              [
                "Рекламные платформы",
                "Идентификаторы браузера, обезличенные события; при согласии — контакты в зашифрованном виде",
                "Реклама и измерение её эффективности, только с вашего согласия",
              ],
              ["Хостинг-провайдер", "IP-адрес, технические логи", "Хостинг сайта и его работоспособность"],
              ["Сервисы доставки", "Имя, телефон, адрес получателя", "Доставка заказа"],
            ],
          },
          after: [
            "Мы не продаём ваши данные и не передаём их третьим лицам для их собственных маркетинговых целей.",
          ],
        },
        {
          heading: "6. Сроки хранения",
          list: [
            "Данные заказа и переписка — до 12 месяцев с момента последнего обращения, дольше, если этого требует закон.",
            "Загруженные вами файлы — до 30 дней после выполнения заказа, затем удаляются.",
            "Технические логи хостинга — до 30 дней.",
            "Cookie и данные аналитики — сроки указаны в Политике cookie.",
          ],
        },
        {
          heading: "7. Ваши права",
          paragraphs: ["В соответствии с применимым законодательством вы вправе:"],
          list: [
            "узнать, обрабатываем ли мы ваши данные, и получить их копию;",
            "потребовать исправления неточных или неполных данных;",
            "потребовать удаления данных, если больше нет оснований их хранить;",
            "отозвать согласие на обработку в любой момент;",
            "возразить против обработки в целях прямого маркетинга;",
            "подать жалобу в уполномоченный орган по защите персональных данных вашей страны.",
          ],
          after: [
            "Чтобы воспользоваться правами, обратитесь к нам через контакты, указанные в разделе «Контакты» на сайте, с темой «Персональные данные». Мы ответим в срок, установленный законом.",
            "Отзыв согласия не влияет на законность обработки, выполненной до отзыва, и не отменяет уже оформленный заказ.",
          ],
        },
        {
          heading: "8. Cookie и похожие технологии",
          paragraphs: [
            "Подробный перечень cookie и способы управления ими — в Политике cookie. Кратко: необходимые cookie работают всегда, аналитика и реклама включаются только с вашего согласия и могут быть отключены в любой момент.",
          ],
        },
        {
          heading: "9. Безопасность",
          paragraphs: [
            "Мы применяем организационные и технические меры: передача данных по HTTPS, ограничение доступа к рабочим каналам и облачному хранилищу, минимизация собираемых данных, удаление загруженных материалов после выполнения заказа.",
            "Абсолютной гарантии безопасности передачи данных по интернету не существует, но мы делаем всё разумно зависящее от нас, чтобы защитить ваши данные.",
          ],
        },
        {
          heading: "10. Изменения политики",
          paragraphs: [
            "Мы можем обновлять эту политику. Актуальная редакция всегда опубликована на этой странице, дата редакции указана в шапке. Существенные изменения мы объявляем на сайте.",
          ],
        },
        {
          heading: "11. Контакты",
          paragraphs: [
            "По вопросам обработки персональных данных используйте контакты, указанные в разделе «Контакты» на сайте.",
          ],
        },
      ],
    },
    cookies: {
      title: "Политика cookie",
      updated: "29 октября 2026",
      intro:
        "Cookie и похожие технологии помогают сайту работать, запоминать ваши настройки и, с вашего согласия, измерять эффективность рекламы. Здесь мы объясняем, какие из них мы используем и как ими управлять.",
      sections: [
        {
          heading: "1. Что такое cookie",
          paragraphs: [
            "Cookie — это небольшие файлы, которые сайт сохраняет в вашем браузере. Они бывают «необходимыми» (без них сайт не работает корректно) и «необязательными» (аналитика, реклама).",
            "Аналогично работают localStorage и sessionStorage — хранилище браузера, куда мы сохраняем ваши настройки. В этой политике мы объединяем их под общим названием «cookie».",
          ],
        },
        {
          heading: "2. Категории, которые мы используем",
          list: [
            "Необходимые — работа сайта, язык интерфейса, запоминание вашего выбора в отношении cookie. Работают всегда.",
            "Аналитика — статистика посещений, чтобы понимать, какие разделы полезны и что стоит улучшить. Включаются только с вашего согласия.",
            "Маркетинг — рекламные пиксели и измерение эффективности рекламы. Включаются только с вашего согласия.",
          ],
        },
        {
          heading: "3. Полный список",
          table: {
            head: ["Имя", "Категория", "Назначение", "Срок", "Провайдер"],
            rows: [
              [
                "photobrelok_lang",
                "Необходимые",
                "Запоминание выбранного языка интерфейса",
                "До очистки данных браузера",
                "Мы",
              ],
              [
                "photobrelok_occasion",
                "Необходимые",
                "Выбранный повод для подарка в конструкторе",
                "До очистки данных браузера",
                "Мы",
              ],
              [
                "photobrelok_consent",
                "Необходимые",
                "Запоминание вашего выбора в отношении cookie",
                "12 месяцев",
                "Мы",
              ],
              [
                "photobrelok_draft (IndexedDB)",
                "Необходимые",
                "Выбранные и обрезанные фото для заказа хранятся на вашем устройстве, пока вы не отправите заказ. Нам они не передаются",
                "7 дней",
                "Мы",
              ],
              [
                "_fbp",
                "Маркетинг",
                "Идентификатор браузера для рекламы и аналитики Meta",
                "90 дней",
                "Meta",
              ],
              [
                "_fbc",
                "Маркетинг",
                "Идентификатор перехода из рекламы Meta",
                "90 дней",
                "Meta",
              ],
            ],
          },
          after: [
            "Дополнительно: при открытии сайта браузер запрашивает шрифты у внешнего сервиса. Это не cookie, но при запросе провайдер получает ваш IP-адрес. Если вы не давали согласия на маркетинг, рекламные cookie при этом не устанавливаются.",
          ],
        },
        {
          heading: "4. Как управлять cookie",
          list: [
            "Через баннер на сайте — кнопки «Принять все», «Только необходимые» и «Настроить» позволяют выбрать категории вручную.",
            "Через настройки браузера — вы можете удалить сохранённые cookie или запретить их сохранение. В этом случае часть функций сайта может работать нестабильно.",
            "Отозвать согласие можно в любой момент, удалив cookie в браузере или очистив данные сайта. После этого рекламные и аналитические технологии перестанут использоваться при следующем заходе.",
          ],
        },
        {
          heading: "5. Сторонние сервисы",
          paragraphs: [
            "Cookie и технологии маркетинга принадлежат соответствующим провайдерам и регулируются их политиками конфиденциальности. Мы не контролируем их техническую часть и рекомендуем ознакомиться с документами на сайтах этих сервисов.",
          ],
        },
        {
          heading: "6. Обновления политики",
          paragraphs: [
            "Мы можем обновлять этот список при изменении используемых технологий. Актуальная редакция опубликована на этой странице, дата редакции указана в шапке.",
          ],
        },
      ],
    },
  },
  ro: {
    contactLine:
      "Pentru întrebări privind prelucrarea datelor cu caracter personal folosiți contactele indicate în secțiunea „Contacte” de pe site.",
    nav: {
      backToSite: "Înapoi la site",
      privacy: "Politica de confidențialitate",
      cookies: "Politica privind cookie-urile",
      updatedPrefix: "Redacția din",
    },
    banner: {
      title: "Folosim cookie-uri",
      text: "Cookie-urile necesare asigură funcționarea site-ului. Analiza și publicitatea se activează doar cu acordul dumneavoastră. Detalii — în politica privind cookie-urile.",
      acceptAll: "Acceptă toate",
      necessaryOnly: "Doar necesare",
      settings: "Setări",
      settingsTitle: "Setări cookie",
      necessaryLabel: "Necesare",
      necessaryDesc:
        "Funcționarea site-ului, limba interfeței, memorarea alegerii dumneavoastră. Nu pot fi dezactivate.",
      analyticsLabel: "Analiză",
      analyticsDesc:
        "Ne ajută să înțelegem cum este folosit site-ul, pentru a-l îmbunătăți.",
      marketingLabel: "Marketing",
      marketingDesc: "Publicitate și măsurarea eficienței acesteia (pixelul Meta).",
      save: "Salvează alegerea",
    },
    privacy: {
      title: "Politica de confidențialitate",
      updated: "29 octombrie 2026",
      intro:
        "Această politică explică ce date cu caracter personal colectează serviciul PHOTOBRELOK, de ce sunt necesare, cui le transmitem și cum le puteți gestiona. Prin utilizarea site-ului și plasarea comenzii confirmați că ați luat cunoștință de această politică.",
      sections: [
        {
          heading: "1. Cine suntem",
          paragraphs: [
            "PHOTOBRELOK (în continuare — „noi”, „Serviciul”) — serviciul care confecționează produsele comandate de dumneavoastră pe baza materialelor dumneavoastră.",
            "Stabilim scopurile și mijloacele de prelucrare a datelor cu caracter personal și acționăm ca operator de date în sensul legislației aplicabile privind protecția datelor cu caracter personal. Dacă vă aflați în UE/SEE, acționăm și ca operator în sensul GDPR.",
            "Pentru orice întrebare privind prelucrarea datelor cu caracter personal folosiți contactele indicate în secțiunea „Contacte” de pe site.",
          ],
        },
        {
          heading: "2. Ce date prelucrăm",
          table: {
            head: ["Date", "De ce sunt necesare"],
            rows: [
              ["Numele", "Întocmirea comenzii, adresarea către dumneavoastră, pregătirea machetei"],
              ["Numărul de telefon", "Comunicarea despre comandă, clarificarea detaliilor, livrarea"],
              [
                "Adresa de livrare: cod poștal, localitate, raion, stradă",
                "Doar dacă alegeți livrarea prin curier sau poștă",
              ],
              [
                "Fișierele și imaginile pe care le încărcați",
                "Confecționarea mărfii sau serviciului comandat",
              ],
              [
                "Limba interfeței și alte preferințe",
                "Se păstrează în browserul dumneavoastră (localStorage) și nu sunt transmise către noi",
              ],
              [
                "Adresa IP, tipul browserului, sursa accesării",
                "Funcționarea site-ului, prevenirea abuzurilor, iar cu acordul dumneavoastră — analiza și publicitatea",
              ],
            ],
          },
        },
        {
          heading: "3. În ce scopuri și pe ce temei",
          table: {
            head: ["Scop", "Temeiul"],
            rows: [
              [
                "Întocmirea și executarea comenzii, confecționarea mărfii",
                "Acordul dumneavoastră la plasarea comenzii și acțiunile privind executarea contractului",
              ],
              ["Comunicarea despre comandă, clarificarea detaliilor", "Executarea contractului"],
              ["Livrarea comenzii", "Executarea contractului"],
              ["Analiza utilizării site-ului", "Acordul dumneavoastră separat prin bannerul de cookie-uri"],
              ["Publicitatea și măsurarea eficienței acesteia", "Acordul dumneavoastră separat prin bannerul de cookie-uri"],
              ["Asigurarea securității și prevenirea fraudelor", "Interesul legitim"],
            ],
          },
        },
        {
          heading: "4. Materialele pe care le încărcați",
          paragraphs: [
            "Încărcați doar acele fișiere și imagini pe care aveți dreptul să le utilizați și pentru care ați obținut acordul persoanelor fotografiate.",
            "Folosim materialele încărcate exclusiv pentru pregătirea comenzii și confecționarea acesteia. Nu le publicăm, nu le folosim în publicitate și nu le arătăm altor clienți. Singura excepție este necesitatea de a vă arăta rezultatul spre aprobare și de a transmite fișierul în producție.",
          ],
        },
        {
          heading: "5. Cui transmitem datele",
          paragraphs: ["Transmiterea către terți se limitează la ce este necesar pentru funcționarea serviciului."],
          table: {
            head: ["Categoria destinatarului", "Ce transmitem", "De ce"],
            rows: [
              [
                "Serviciul de stocare în cloud",
                "Fișierele încărcate de dumneavoastră",
                "Stocare temporară pentru pregătirea și confecționarea comenzii",
              ],
              [
                "Aplicație de mesagerie sau CRM pentru prelucrarea comenzilor",
                "Nume, telefon, adresa, fișierul comenzii",
                "Transmiterea comenzii în canalul de lucru al producției",
              ],
              [
                "Platforme de publicitate",
                "Identificatorii browserului, evenimente anonimizate; cu acordul dumneavoastră — contacte în formă criptată",
                "Publicitatea și măsurarea eficienței acesteia, doar cu acordul dumneavoastră",
              ],
              [
                "Furnizorul de găzduire",
                "Adresa IP, jurnale tehnice",
                "Găzduirea site-ului și funcționarea acestuia",
              ],
              ["Serviciile de livrare", "Nume, telefon, adresa destinatarului", "Livrarea comenzii"],
            ],
          },
          after: [
            "Nu vindem datele dumneavoastră și nu le transmitem terților pentru scopurile lor proprii de marketing.",
          ],
        },
        {
          heading: "6. Termenele de păstrare",
          list: [
            "Datele comenzii și corespondența — până la 12 luni de la ultima adresare, mai mult dacă legea o cere.",
            "Fișierele încărcate de dumneavoastră — până la 30 de zile după executarea comenzii, apoi sunt șterse.",
            "Jurnalele tehnice de găzduire — până la 30 de zile.",
            "Cookie-urile și datele de analiză — termenele sunt indicate în Politica privind cookie-urile.",
          ],
        },
        {
          heading: "7. Drepturile dumneavoastră",
          paragraphs: ["În conformitate cu legislația aplicabilă aveți dreptul:"],
          list: [
            "să aflați dacă prelucrăm datele dumneavoastră și să obțineți o copie a acestora;",
            "să solicitați corectarea datelor inexacte sau incomplete;",
            "să solicitați ștergerea datelor, dacă nu mai există temei pentru păstrarea lor;",
            "să vă retrageți acordul de prelucrare în orice moment;",
            "să vă opuneți prelucrării în scopuri de marketing direct;",
            "să depuneți o plângere la autoritatea competentă pentru protecția datelor cu caracter personal din țara dumneavoastră.",
          ],
          after: [
            "Pentru a vă exercita drepturile, adresați-ne o cerere prin contactele indicate în secțiunea „Contacte” de pe site, cu subiectul „Date cu caracter personal”. Vom răspunde în termenul prevăzut de lege.",
            "Retragerea acordului nu afectează legalitatea prelucrării efectuate până la retragere și nu anulează comanda deja plasată.",
          ],
        },
        {
          heading: "8. Cookie-uri și tehnologii similare",
          paragraphs: [
            "Lista detaliată a cookie-urilor și modalitățile de gestionare a acestora — în Politica privind cookie-urile. Pe scurt: cookie-urile necesare funcționează întotdeauna, analiza și publicitatea se activează doar cu acordul dumneavoastră și pot fi dezactivate în orice moment.",
          ],
        },
        {
          heading: "9. Securitate",
          paragraphs: [
            "Aplicăm măsuri organizatorice și tehnice: transmiterea datelor prin HTTPS, limitarea accesului la canalele de lucru și la serviciul de stocare, minimizarea datelor colectate, ștergerea materialelor încărcate după executarea comenzii.",
            "Nu există o garanție absolută a securității transmiterii datelor prin internet, dar facem tot ce depinde în mod rezonabil de noi pentru a vă proteja datele.",
          ],
        },
        {
          heading: "10. Modificarea politicii",
          paragraphs: [
            "Putem actualiza această politică. Redacția în vigoare este publicată întotdeauna pe această pagină, iar data redacției este indicată în antet. Modificările esențiale le anunțăm pe site.",
          ],
        },
        {
          heading: "11. Contacte",
          paragraphs: [
            "Pentru întrebări privind prelucrarea datelor cu caracter personal folosiți contactele indicate în secțiunea „Contacte” de pe site.",
          ],
        },
      ],
    },
    cookies: {
      title: "Politica privind cookie-urile",
      updated: "29 octombrie 2026",
      intro:
        "Cookie-urile și tehnologiile similare ajută site-ul să funcționeze, să vă rețină preferințele și, cu acordul dumneavoastră, să măsoare eficiența publicității. Aici explicăm ce anume folosim și cum puteți gestiona acest lucru.",
      sections: [
        {
          heading: "1. Ce sunt cookie-urile",
          paragraphs: [
            "Cookie-urile sunt fișiere mici pe care site-ul le păstrează în browserul dumneavoastră. Ele pot fi „necesare” (fără ele site-ul nu funcționează corect) și „opționale” (analiză, publicitate).",
            "În mod similar funcționează localStorage și sessionStorage — spațiul de stocare al browserului unde salvăm preferințele dumneavoastră. În această politică le numim împreună „cookie-uri”.",
          ],
        },
        {
          heading: "2. Categoriile pe care le folosim",
          list: [
            "Necesare — funcționarea site-ului, limba interfeței, memorarea alegerii dumneavoastră privind cookie-urile. Funcționează întotdeauna.",
            "Analiză — statistică privind vizitele, pentru a înțelege ce secțiuni sunt utile și ce trebuie îmbunătățit. Se activează doar cu acordul dumneavoastră.",
            "Marketing — pixeli publicitari și măsurarea eficienței publicității. Se activează doar cu acordul dumneavoastră.",
          ],
        },
        {
          heading: "3. Lista completă",
          table: {
            head: ["Denumire", "Categorie", "Destinație", "Termen", "Furnizor"],
            rows: [
              [
                "photobrelok_lang",
                "Necesare",
                "Memorarea limbii interfeței alese",
                "Până la curățarea datelor browserului",
                "Noi",
              ],
              [
                "photobrelok_occasion",
                "Necesare",
                "Ocazia aleasă pentru cadou în constructor",
                "Până la curățarea datelor browserului",
                "Noi",
              ],
              [
                "photobrelok_consent",
                "Necesare",
                "Memorarea alegerii dumneavoastră privind cookie-urile",
                "12 luni",
                "Noi",
              ],
              [
                "photobrelok_draft (IndexedDB)",
                "Necesare",
                "Pozele alese și decupate pentru comandă se păstrează pe dispozitivul dumneavoastră până trimiteți comanda. Nouă nu ne sunt transmise",
                "7 zile",
                "Noi",
              ],
              [
                "_fbp",
                "Marketing",
                "Identificatorul browserului pentru publicitatea și analiza Meta",
                "90 de zile",
                "Meta",
              ],
              [
                "_fbc",
                "Marketing",
                "Identificatorul accesării din publicitatea Meta",
                "90 de zile",
                "Meta",
              ],
            ],
          },
          after: [
            "Suplimentar: la deschiderea site-ului browserul solicită fonturile de la un serviciu extern. Aceasta nu este o cookie, dar la cerere furnizorul primește adresa dumneavoastră IP. Dacă nu ați dat acordul pentru marketing, cookie-urile de publicitate nu sunt instalate.",
          ],
        },
        {
          heading: "4. Cum gestionați cookie-urile",
          list: [
            "Prin bannerul de pe site — butoanele „Accept toate”, „Doar necesare” și „Setări” permit alegerea manuală a categoriilor.",
            "Prin setările browserului — puteți șterge cookie-urile salvate sau interzice salvarea lor. În acest caz, unele funcții ale site-ului pot funcționa instabil.",
            "Acordul poate fi retras în orice moment, ștergând cookie-urile din browser sau curățând datele site-ului. După aceasta, tehnologiile de publicitate și analiză nu vor mai fi utilizate la următoarea accesare.",
          ],
        },
        {
          heading: "5. Servicii terțe",
          paragraphs: [
            "Cookie-urile și tehnologiile de marketing aparțin furnizorilor respectivi și sunt reglementate de politicele lor de confidențialitate. Nu controlăm partea lor tehnică și vă recomandăm să consultați documentele pe site-urile acelor servicii.",
          ],
        },
        {
          heading: "6. Actualizarea politicii",
          paragraphs: [
            "Putem actualiza această listă atunci când se schimbă tehnologiile utilizate. Redacția în vigoare este publicată pe această pagină, iar data redacției este indicată în antet.",
          ],
        },
      ],
    },
  },
};
