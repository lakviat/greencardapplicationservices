const translations = {
  en: {
    navService: "Service",
    navApply: "Apply",
    navPayment: "Payment",
    navFaq: "FAQ",
    startApplication: "Start Application",
    heroEyebrow: "Diversity Visa application support",
    heroTitle: "Become a U.S. green card holder",
    heroCopy:
      "We help you prepare a careful Diversity Visa entry, review your photo, organize your documents, and follow up after submission.",
    howItWorks: "How it works",
    heroDisclaimer: "Not a law firm. Not affiliated with USCIS or the U.S. Department of State.",
    statVisa: "Up to 55,000",
    statVisaLabel: "diversity visas annually",
    statFee: "$100",
    statFeeLabel: "service fee",
    statFollow: "Follow-up",
    statFollowLabel: "after payment is received",
    serviceEyebrow: "Trusted service, simple process",
    serviceTitle: "We focus on the details that matter.",
    serviceCopy:
      "The DV entry has strict rules for photos, country eligibility, family details, names, dates, and deadlines. Our job is to help reduce preventable mistakes and keep your application organized.",
    stepOneTitle: "Submit request",
    stepOneCopy: "Send your basic information, email, phone, and photo.",
    stepTwoTitle: "Pay service fee",
    stepTwoCopy: "Once payment is received, our team contacts you directly.",
    stepThreeTitle: "Review and submit",
    stepThreeCopy:
      "We review, prepare, confirm details with you, and submit in the official window.",
    paymentNoticeEyebrow: "Important payment notice",
    paymentNoticeTitle: "Communication starts after payment is received.",
    paymentNoticeCopy:
      "After we receive your service payment, we will contact you by email, phone, or WhatsApp to continue the application process, request missing details, and confirm next steps.",
    applyEyebrow: "Start here",
    applyTitle: "Application support request",
    applyCopy:
      "This is the first version of the intake form. Payment processing and secure document upload will be connected in the next build step.",
    checkEmail: "Email must be entered twice.",
    checkCountry: "Country field will use eligible DV countries only.",
    checkPhoto: "Photo review follows official DV requirements.",
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
    confirmEmail: "Confirm email",
    phone: "Phone / WhatsApp",
    country: "Country of birth / chargeability",
    chooseCountry: "Choose eligible country",
    notes: "What language should we use when contacting you?",
    consent:
      "I understand this is paid preparation support, not legal advice or a government service.",
    requestCallback: "Request payment details",
    paymentEyebrow: "Payment",
    paymentTitle: "$100 service fee",
    paymentCopy:
      "We plan to support secure online payment first. If Stripe is not available for the final setup, we can add invoice-based options such as PayPal, Wise Business, or bank transfer after review.",
    paymentCardTitle: "After payment",
    paymentCardCopy:
      "We contact you, verify your information, review your photo, prepare the entry, and send the official confirmation details after successful submission.",
    faqEyebrow: "Clear expectations",
    faqTitle: "Small page. Big clarity.",
    faqOneTitle: "Can you guarantee selection?",
    faqOneCopy:
      "No. The DV program is a random lottery. We help with accurate preparation and submission support.",
    faqTwoTitle: "Can I apply myself?",
    faqTwoCopy:
      "Yes. You can apply directly through the official government website during the registration period.",
    faqThreeTitle: "When will you contact me?",
    faqThreeCopy:
      "We begin direct communication after your payment is received and matched to your request.",
    footerCopy: "Miami-based application support for Diversity Visa applicants around the world.",
    footerDisclaimer:
      "Not a law firm. Not legal advice. Not affiliated with USCIS, the U.S. Department of State, or any U.S. government agency. Official DV information: dvprogram.state.gov.",
    formEmailMismatch: "Please make sure both email fields match.",
    formSuccess:
      "Request saved in this page preview. Next step: connect payment and secure submission."
  },
  es: {
    navService: "Servicio",
    navApply: "Aplicar",
    navPayment: "Pago",
    navFaq: "FAQ",
    startApplication: "Empezar solicitud",
    heroEyebrow: "Soporte para la Loteria de Visas",
    heroTitle: "Busca tu green card de EE. UU.",
    heroCopy:
      "Te ayudamos a preparar una entrada cuidadosa, revisar la foto, organizar documentos y hacer seguimiento.",
    howItWorks: "Como funciona",
    heroDisclaimer: "No somos abogados. No estamos afiliados con USCIS ni el Departamento de Estado.",
    statVisa: "Hasta 55,000",
    statVisaLabel: "visas de diversidad al ano",
    statFee: "$100",
    statFeeLabel: "tarifa de servicio",
    statFollow: "Seguimiento",
    statFollowLabel: "despues de recibir el pago"
  },
  ru: {
    navService: "Сервис",
    navApply: "Заявка",
    navPayment: "Оплата",
    navFaq: "FAQ",
    startApplication: "Начать заявку",
    heroEyebrow: "Поддержка Diversity Visa",
    heroTitle: "Подайте заявку на Green Card",
    heroCopy:
      "Мы помогаем аккуратно подготовить заявку DV, проверить фото, собрать документы и вести дальнейшую коммуникацию.",
    howItWorks: "Как работает",
    heroDisclaimer: "Мы не юридическая фирма и не связаны с USCIS или Госдепартаментом США.",
    statVisa: "До 55,000",
    statVisaLabel: "diversity visas ежегодно",
    statFee: "$100",
    statFeeLabel: "стоимость сервиса",
    statFollow: "Связь",
    statFollowLabel: "после получения оплаты"
  }
};

const select = document.querySelector("#languageSelect");
const form = document.querySelector("#intakeForm");
const message = document.querySelector("#formMessage");

function applyLanguage(language) {
  const dictionary = { ...translations.en, ...translations[language] };
  document.documentElement.lang = language;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    if (dictionary[key]) {
      element.textContent = dictionary[key];
    }
  });
}

select.addEventListener("change", (event) => {
  applyLanguage(event.target.value);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const email = String(data.get("email") || "").trim().toLowerCase();
  const confirmEmail = String(data.get("confirmEmail") || "").trim().toLowerCase();
  const dictionary = { ...translations.en, ...translations[select.value] };

  if (email !== confirmEmail) {
    message.textContent = dictionary.formEmailMismatch;
    message.style.color = "#c5221f";
    return;
  }

  message.textContent = dictionary.formSuccess;
  message.style.color = "#174ea6";
});

applyLanguage("en");
