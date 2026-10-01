const form = document.querySelector("#intakeForm");
const applicationGuide = document.querySelector(".application-guide");
const message = document.querySelector("#formMessage");
const submitButton = document.querySelector("#applicationSubmit");
const paymentStatus = document.querySelector("#paymentStatus");
const packageOptions = document.querySelectorAll('input[name="package"]');
const premiumCountField = document.querySelector("#premiumCountField");
const premiumApplicantCount = document.querySelector("#premiumApplicantCount");
const identityDocumentInput = document.querySelector("#identityDocuments");
const fileUploadSelection = document.querySelector("#fileUploadSelection");
const additionalApplicantSections = document.querySelectorAll(
  "[data-applicant-section]",
);
const notifyForm = document.querySelector("#notifyForm");
const notifyMessage = document.querySelector("#notifyMessage");
const notifySubmitButton = document.querySelector("#notifySubmit");
const notifyModal = document.querySelector("#notifyModal");
const notifyOpenButtons = document.querySelectorAll("[data-notify-open]");
const notifyCloseButtons = document.querySelectorAll("[data-notify-close]");
const mobileMenus = document.querySelectorAll(".mobile-menu");
const applySection = document.querySelector("#apply");
const heroSection = document.querySelector(".hero-dashboard");
const heroPauseButton = document.querySelector("[data-hero-pause]");
const siteFooter = document.querySelector(".site-footer");
const honeypotField = document.querySelector("#companyWebsite");
const notifyHoneypotField = document.querySelector("#notifyCompanyWebsite");
const googleScriptIntakeUrl =
  "https://script.google.com/macros/s/AKfycbyZp6oqQoPsP6o2RwaFlflHgfF9QAfjtlp172XQZCqEUnV3g3YiwmBYoW0HoFIwN9kv/exec";
const googleScriptNotifyUrl =
  "https://script.google.com/macros/s/AKfycbzfG-PHP8OR4qR6YGP1dcJ9eXQ8Crrg9ag1jG_WonTdGpwRVcsL5TMDfQADyqnyMg60/exec";
// Kept only for compatibility with the currently deployed Apps Scripts. This
// value is public browser code and must never be treated as authentication.
const appsScriptCompatibilityToken = "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET";
const maxFiles = 8;
const maxFileSize = 15 * 1024 * 1024;
const maxTotalUploadSize = 35 * 1024 * 1024;
const allowedUploadExtensions = new Set([
  "jpg",
  "jpeg",
  "png",
  "pdf",
  "heic",
  "heif",
]);
const allowedUploadTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "application/pdf",
]);
const faqGroups = document.querySelectorAll("[data-faq-accordion]");
const countdownPanel = document.querySelector("[data-dv-countdown]");
const countryCombobox = document.querySelector("[data-country-combobox]");
const stripePackages = {
  single: {
    label: "Single",
    amount: 24,
    paymentLink: "https://buy.stripe.com/9B614p5JI4SH6xNd0U0Ny05",
  },
  couple: {
    label: "Couple",
    amount: 44,
    paymentLink: "https://buy.stripe.com/28E28t5JI4SH1dt1ic0Ny06",
  },
  family: {
    label: "Family",
    amount: 64,
    paymentLink: "https://buy.stripe.com/eVqbJ34FE98X6xN6Cw0Ny07",
  },
  premium: {
    label: "Premium",
    amount: 94,
    paymentLink: "https://buy.stripe.com/cNiaEZ2xw1Gv4pFd0U0Ny08",
  },
};

const trackConversion = (event, metadata = {}) => {
  try {
    return window.gcasAnalytics?.track(event, metadata);
  } catch {
    // Optional measurement must never interrupt a form or support action.
    return false;
  }
};

const trackFormInteraction = (targetForm, formId) => {
  if (!targetForm) return;
  const start = () => trackConversion("form_start", { form: formId });
  targetForm.addEventListener("input", start);
  targetForm.addEventListener("change", start);
  targetForm.addEventListener("submit", start);
  targetForm.addEventListener("invalid", (event) => {
    const validity = event.target.validity;
    trackConversion("validation_error", {
      form: formId,
      category: validity?.valueMissing
        ? "required"
        : validity?.typeMismatch || validity?.patternMismatch
          ? "format"
          : "constraint",
    });
  }, true);
};

trackFormInteraction(form, "application");
trackFormInteraction(notifyForm, "notification");

const heroImages = new Map();
const prepareHeroImages = () => {
  heroSection?.querySelectorAll(".hero-photo-slide").forEach((slide) => {
    const background = window.getComputedStyle(slide).backgroundImage;
    const source = background.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
    if (!source || heroImages.has(slide)) return;
    const image = new window.Image();
    image.src = source;
    heroImages.set(slide, image);
  });
};

if (heroSection && heroPauseButton) {
  let heroPaused = false;
  let pausedFrame = null;
  const slides = Array.from(heroSection.querySelectorAll(".hero-photo-slide"));
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  prepareHeroImages();
  heroPauseButton.setAttribute("aria-pressed", "false");
  heroPauseButton.addEventListener("click", () => {
    if (motionPreference.matches) return;
    if (!heroPaused) {
      prepareHeroImages();
      const loaded = slides.filter((slide) => {
        const image = heroImages.get(slide);
        return image?.complete && image.naturalWidth > 0;
      });
      pausedFrame = loaded.reduce((best, slide) =>
        !best || Number(window.getComputedStyle(slide).opacity) >
          Number(window.getComputedStyle(best).opacity) ? slide : best, null);
      if (!pausedFrame) return;
      pausedFrame.classList.add("is-paused-frame");
    } else {
      // Resume from the selected photo's opaque hold, not the interrupted blend.
      const animation = pausedFrame?.getAnimations?.()[0];
      if (animation) {
        const timing = animation.effect.getTiming();
        const time = timing.delay + Number(timing.duration) + 1000;
        heroSection.querySelectorAll(".hero-photo-slide, .hero-carousel-dots span")
          .forEach((element) => element.getAnimations().forEach((item) => {
            item.currentTime = time;
          }));
      }
      slides.forEach((slide) => slide.classList.remove("is-paused-frame"));
    }
    heroPaused = !heroPaused;
    heroSection.classList.toggle("is-paused", heroPaused);
    heroPauseButton.setAttribute("aria-pressed", String(heroPaused));
    heroPauseButton.textContent = heroPaused ? "Resume photos" : "Pause photos";
  });
}

if (applicationGuide) {
  const applicationGuideMobile = window.matchMedia("(max-width: 1000px)");
  const syncApplicationGuide = ({ matches }) => {
    applicationGuide.open = !matches;
  };

  syncApplicationGuide(applicationGuideMobile);
  applicationGuideMobile.addEventListener("change", syncApplicationGuide);
}

const cleanText = (value, maxLength = 200) =>
  String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const initializeCountryCombobox = () => {
  if (!countryCombobox) return;

  const sourceSelect = countryCombobox.querySelector('select[name="country"]');
  const searchControl = countryCombobox.querySelector(
    ".country-search-control",
  );
  const searchInput = countryCombobox.querySelector(".country-search-input");
  const toggleButton = countryCombobox.querySelector(".country-search-toggle");
  const optionsList = countryCombobox.querySelector(".country-search-options");
  const searchStatus = countryCombobox.querySelector(
    "[data-country-search-status]",
  );

  if (
    !sourceSelect ||
    !searchControl ||
    !searchInput ||
    !toggleButton ||
    !optionsList
  ) {
    return;
  }

  const countries = Array.from(sourceSelect.options)
    .filter((option) => option.value)
    .map((option) => ({ label: option.textContent.trim(), value: option.value }));
  const normalizeCountry = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase()
      .trim();
  let filteredCountries = countries;
  let activeIndex = -1;

  const closeOptions = () => {
    optionsList.hidden = true;
    searchInput.setAttribute("aria-expanded", "false");
    searchInput.removeAttribute("aria-activedescendant");
    activeIndex = -1;
  };

  const setActiveOption = (nextIndex) => {
    const optionButtons = Array.from(
      optionsList.querySelectorAll("[data-country-option]"),
    );
    if (!optionButtons.length) return;

    activeIndex = (nextIndex + optionButtons.length) % optionButtons.length;
    optionButtons.forEach((button, index) => {
      const isActive = index === activeIndex;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });

    const activeOption = optionButtons[activeIndex];
    searchInput.setAttribute("aria-activedescendant", activeOption.id);
    activeOption.scrollIntoView({ block: "nearest" });
  };

  const selectCountry = (country) => {
    sourceSelect.value = country.value;
    searchInput.value = country.label;
    searchInput.setCustomValidity("");
    sourceSelect.dispatchEvent(new Event("change", { bubbles: true }));
    closeOptions();
  };

  const renderOptions = (query = "") => {
    const normalizedQuery = normalizeCountry(query);
    filteredCountries = normalizedQuery
      ? countries.filter((country) =>
          normalizeCountry(country.label).startsWith(normalizedQuery),
        )
      : countries;
    activeIndex = -1;
    optionsList.replaceChildren();

    if (!filteredCountries.length) {
      const emptyMessage = document.createElement("p");
      emptyMessage.className = "country-search-empty";
      emptyMessage.textContent = "No eligible country starts with those letters.";
      optionsList.append(emptyMessage);
    } else {
      const fragment = document.createDocumentFragment();
      filteredCountries.forEach((country, index) => {
        const optionButton = document.createElement("button");
        optionButton.id = `country-search-option-${index}`;
        optionButton.className = "country-search-option";
        optionButton.type = "button";
        optionButton.tabIndex = -1;
        optionButton.dataset.countryOption = country.value;
        optionButton.setAttribute("role", "option");
        optionButton.setAttribute("aria-selected", "false");
        optionButton.textContent = country.label;
        optionButton.addEventListener("mousedown", (event) => {
          event.preventDefault();
        });
        optionButton.addEventListener("click", () => selectCountry(country));
        fragment.append(optionButton);
      });
      optionsList.append(fragment);
    }

    optionsList.hidden = false;
    searchInput.setAttribute("aria-expanded", "true");
    if (searchStatus) {
      searchStatus.textContent = filteredCountries.length
        ? `${filteredCountries.length} eligible ${
            filteredCountries.length === 1 ? "country" : "countries"
          } found.`
        : "No eligible countries found.";
    }
  };

  const syncExactMatch = () => {
    const normalizedValue = normalizeCountry(searchInput.value);
    const exactCountry = countries.find(
      (country) => normalizeCountry(country.label) === normalizedValue,
    );

    if (exactCountry) {
      sourceSelect.value = exactCountry.value;
      searchInput.value = exactCountry.label;
      searchInput.setCustomValidity("");
      return true;
    }

    sourceSelect.value = "";
    searchInput.setCustomValidity(
      searchInput.value.trim()
        ? "Choose a country from the eligible list."
        : "",
    );
    return false;
  };

  sourceSelect.required = false;
  sourceSelect.tabIndex = -1;
  sourceSelect.setAttribute("aria-hidden", "true");
  sourceSelect.classList.add("country-source-select");
  searchControl.hidden = false;
  searchInput.required = true;

  searchInput.addEventListener("focus", () => renderOptions(searchInput.value));
  searchInput.addEventListener("input", () => {
    sourceSelect.value = "";
    searchInput.setCustomValidity("");
    renderOptions(searchInput.value);
    if (filteredCountries.length) setActiveOption(0);
    syncExactMatch();
  });
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (optionsList.hidden) renderOptions(searchInput.value);
      setActiveOption(activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (optionsList.hidden) renderOptions(searchInput.value);
      setActiveOption(activeIndex < 0 ? filteredCountries.length - 1 : activeIndex - 1);
    } else if (event.key === "Enter" && !optionsList.hidden) {
      event.preventDefault();
      const selectedCountry = filteredCountries[activeIndex];
      if (selectedCountry) selectCountry(selectedCountry);
    } else if (event.key === "Escape") {
      if (sourceSelect.value) {
        searchInput.value = sourceSelect.selectedOptions[0]?.textContent || "";
      }
      closeOptions();
    }
  });
  searchInput.addEventListener("blur", () => {
    window.setTimeout(() => {
      syncExactMatch();
      closeOptions();
    }, 100);
  });
  toggleButton.addEventListener("click", () => {
    searchInput.focus();
    if (optionsList.hidden) {
      renderOptions(searchInput.value);
    } else {
      closeOptions();
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (!countryCombobox.contains(event.target)) closeOptions();
  });
  sourceSelect.form?.addEventListener("reset", () => {
    window.setTimeout(() => {
      searchInput.value = "";
      searchInput.setCustomValidity("");
      closeOptions();
    });
  });
};

initializeCountryCombobox();

const isAllowedUpload = (file) => {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  return (
    allowedUploadExtensions.has(extension) &&
    (!file.type || allowedUploadTypes.has(file.type))
  );
};

if (window.self !== window.top) {
  document.body.classList.add("is-embedded");
  document.querySelectorAll("a, button, input, select, textarea").forEach((element) => {
    element.setAttribute("tabindex", "-1");
    if ("disabled" in element) element.disabled = true;
  });
}

const loadDeferredHeroImages = () => {
  document.querySelectorAll("[data-hero-image]").forEach((slide) => {
    const imageClass = cleanText(slide.dataset.heroImage, 40);
    if (imageClass) slide.classList.add(imageClass);
  });
  prepareHeroImages();
};

if ("requestIdleCallback" in window) {
  window.requestIdleCallback(loadDeferredHeroImages, { timeout: 1500 });
} else {
  window.setTimeout(loadDeferredHeroImages, 200);
}

if (countdownPanel) {
  const targetValue = countdownPanel.dataset.countdownDate?.trim();
  const targetDate = targetValue ? new Date(targetValue) : null;
  const isEstimated = countdownPanel.dataset.countdownStatus === "estimated";
  const heading = countdownPanel.querySelector("[data-countdown-heading]");
  const description = countdownPanel.querySelector(
    "[data-countdown-description]",
  );
  const values = {
    days: countdownPanel.querySelector("[data-countdown-days]"),
    hours: countdownPanel.querySelector("[data-countdown-hours]"),
    minutes: countdownPanel.querySelector("[data-countdown-minutes]"),
  };

  if (targetDate && !Number.isNaN(targetDate.getTime())) {
    countdownPanel.classList.add("is-active");
    heading.textContent = isEstimated
      ? "Until the planning estimate"
      : "Until the published date";
    description.textContent = isEstimated
      ? "Planning estimate only, not a confirmed opening or payment deadline. Check the official Department of State website for current dates."
      : "Verify the current registration schedule with the Department of State.";
    let countdownTimer;

    const updateCountdown = () => {
      const remaining = Math.max(0, targetDate.getTime() - Date.now());
      const totalSeconds = Math.floor(remaining / 1000);

      values.days.textContent = String(
        Math.floor(totalSeconds / 86400),
      ).padStart(2, "0");
      values.hours.textContent = String(
        Math.floor((totalSeconds % 86400) / 3600),
      ).padStart(2, "0");
      values.minutes.textContent = String(
        Math.floor((totalSeconds % 3600) / 60),
      ).padStart(2, "0");

      if (remaining === 0) {
        heading.textContent = isEstimated
          ? "Estimated date reached"
          : "Published date reached";
        description.textContent =
          "This timer does not confirm that registration is open. Check the official Department of State website for current dates before submitting an entry.";
        window.clearInterval(countdownTimer);
      }
    };

    countdownTimer = window.setInterval(updateCountdown, 60000);
    updateCountdown();
  } else {
    countdownPanel.classList.remove("is-active");
    heading.textContent = "Countdown unavailable";
    description.textContent =
      "A valid planning date is unavailable. Check the official Department of State website for current registration dates.";
    Object.values(values).forEach((value) => { if (value) value.textContent = "—"; });
  }
}

faqGroups.forEach((group, groupIndex) => {
  group.classList.add("is-interactive");

  group.querySelectorAll(":scope > article").forEach((item, itemIndex) => {
    const heading = item.querySelector(":scope > h3");
    const answer = item.querySelector(":scope > p");

    if (!heading || !answer) return;

    const answerId = `faq-answer-${groupIndex + 1}-${itemIndex + 1}`;
    const button = document.createElement("button");

    button.className = "faq-toggle";
    button.type = "button";
    button.textContent = heading.textContent.trim();
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", answerId);
    answer.id = answerId;
    answer.hidden = true;
    heading.textContent = "";
    heading.append(button);

    button.addEventListener("click", () => {
      const willOpen = !item.classList.contains("is-open");

      group.querySelectorAll(":scope > article.is-open").forEach((openItem) => {
        const openButton = openItem.querySelector(".faq-toggle");
        const openAnswer = openItem.querySelector(":scope > p");

        openItem.classList.remove("is-open");
        openButton?.setAttribute("aria-expanded", "false");
        if (openAnswer) openAnswer.hidden = true;
      });

      item.classList.toggle("is-open", willOpen);
      button.setAttribute("aria-expanded", String(willOpen));
      answer.hidden = !willOpen;
    });
  });
});

mobileMenus.forEach((menu) => {
  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menu.open = false;
    });
  });
});

document.addEventListener("click", (event) => {
  mobileMenus.forEach((menu) => {
    if (!menu.contains(event.target)) {
      menu.open = false;
    }
  });
});

const updateScrollState = () => {
  document.body.classList.toggle("has-scrolled", window.scrollY > 140);
};

window.addEventListener("scroll", updateScrollState, { passive: true });
updateScrollState();

const openNotifyModal = () => {
  if (!notifyModal) return;

  notifyModal.hidden = false;
  document.body.classList.add("modal-open");
  notifyModal.querySelector("input")?.focus();
};

const closeNotifyModal = () => {
  if (!notifyModal) return;

  notifyModal.hidden = true;
  document.body.classList.remove("modal-open");
};

notifyOpenButtons.forEach((button) => {
  button.addEventListener("click", openNotifyModal);
});

notifyCloseButtons.forEach((button) => {
  button.addEventListener("click", closeNotifyModal);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && notifyModal && !notifyModal.hidden) {
    closeNotifyModal();
  }
});

if (applySection && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    ([entry]) => {
      document.body.classList.toggle("apply-visible", entry.isIntersecting);
    },
    { threshold: 0.12 },
  );

  observer.observe(applySection);
}

if (heroSection && "IntersectionObserver" in window) {
  const heroObserver = new IntersectionObserver(
    ([entry]) => {
      document.body.classList.toggle("hero-visible", entry.isIntersecting);
    },
    { rootMargin: "-18% 0px -52% 0px", threshold: 0 },
  );

  heroObserver.observe(heroSection);
}

if (siteFooter && "IntersectionObserver" in window) {
  const footerObserver = new IntersectionObserver(
    ([entry]) => {
      document.body.classList.toggle("footer-visible", entry.isIntersecting);
    },
    { threshold: 0.02 },
  );

  footerObserver.observe(siteFooter);
}

if (form && message) {
  form.dataset.startedAt = new Date().toISOString();
  let applicationPending = false;
  let committedSelection = null;
  let lastRequestSnapshot = null;
  let lastRequestResolved = false;
  let retryAllowedAt = 0;
  const retryCooldownMs = 125000;
  const packageControls = [...packageOptions, premiumApplicantCount].filter(Boolean);
  const previousDisabledStates = new Map();

  const getSelectedPackage = () =>
    document.querySelector('input[name="package"]:checked');

  const getApplicantCount = () => {
    const selectedPackage = getSelectedPackage();

    if (selectedPackage?.value === "premium") {
      return Number(premiumApplicantCount?.value || 1);
    }

    return Number(selectedPackage?.dataset.applicantCount || 1);
  };

  const getSelectedStripePackage = () => {
    const packageKey = getSelectedPackage()?.value || "single";
    return Object.hasOwn(stripePackages, packageKey)
      ? stripePackages[packageKey]
      : stripePackages.single;
  };

  const setFormMessage = (text, state = "info") => {
    message.textContent = text;
    message.classList.remove("is-info", "is-error", "is-success");

    if (text) {
      message.classList.add(`is-${state}`);
    }
  };

  const getSubmissionId = () => {
    if (form.dataset.submissionId) {
      return form.dataset.submissionId;
    }

    const random =
      window.crypto && "randomUUID" in window.crypto
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    form.dataset.submissionId = `gcas-${random}`;
    return form.dataset.submissionId;
  };

  const updateApplicantSections = () => {
    const applicantCount = getApplicantCount();
    const selectedPackage = getSelectedPackage();
    const isPremium = selectedPackage?.value === "premium";

    if (premiumCountField) {
      premiumCountField.hidden = !isPremium;
    }

    additionalApplicantSections.forEach((section) => {
      const sectionNumber = Number(section.dataset.applicantSection || 0);
      const isVisible = sectionNumber <= applicantCount;

      section.hidden = !isVisible;
      section
        .querySelectorAll("[data-additional-required]")
        .forEach((field) => {
          field.required = isVisible;
        });
    });
  };

  const setSubmitState = (state) => {
    if (!submitButton) return;

    submitButton.classList.toggle("is-submitting", state === "submitting");
    submitButton.classList.remove("is-submitted");
    submitButton.disabled = state === "submitting" || state === "redirecting";

    if (state === "submitting") {
      submitButton.textContent = "Sending your preparation request...";
    } else if (state === "redirecting") {
      submitButton.textContent = "Opening secure checkout...";
    } else {
      updateSubmitLabel();
    }
  };

  const fileToPayload = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.addEventListener("load", () => {
        const result = String(reader.result || "");
        const base64 = result.includes(",") ? result.split(",").pop() : result;

        resolve({
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          base64,
        });
      });

      reader.addEventListener("error", () => {
        reject(new Error("Unable to read the uploaded document."));
      });

      reader.readAsDataURL(file);
    });

  const buildApplicationPayload = async () => {
    const formData = new FormData(form);
    const submissionId = getSubmissionId();
    const policyAgreedAt = new Date().toISOString();
    const selectedPackage = getSelectedPackage();
    const selectedPackageLabel =
      selectedPackage
        ?.closest("label")
        ?.querySelector("strong")
        ?.textContent?.trim() || "Single";
    const applicantCount = getApplicantCount();
    const uploadedFiles = formData
      .getAll("identityDocument")
      .filter((file) => file instanceof File && file.size > 0);
    const totalUploadSize = uploadedFiles.reduce(
      (total, file) => total + file.size,
      0,
    );

    if (uploadedFiles.length > maxFiles) {
      trackConversion("validation_error", { form: "application", category: "upload" });
      throw new Error(`Upload up to ${maxFiles} files at a time.`);
    }

    if (uploadedFiles.some((file) => file.size > maxFileSize)) {
      trackConversion("validation_error", { form: "application", category: "upload" });
      throw new Error(
        "One of the selected files is too large. Please keep each file under 15 MB.",
      );
    }

    if (totalUploadSize > maxTotalUploadSize) {
      trackConversion("validation_error", { form: "application", category: "upload" });
      throw new Error(
        "The selected files are too large together. Please keep the total upload under 35 MB.",
      );
    }

    if (uploadedFiles.some((file) => !isAllowedUpload(file))) {
      trackConversion("validation_error", { form: "application", category: "upload" });
      throw new Error(
        "Upload PDF, JPEG, PNG, HEIC, or HEIF documents only.",
      );
    }

    const files = await Promise.all(uploadedFiles.map(fileToPayload));
    const additionalApplicants = [2, 3]
      .filter((number) => number <= applicantCount)
      .map((number) => ({
        applicantNumber: number,
        firstName: cleanText(formData.get(`applicant${number}FirstName`), 100),
        middleName: cleanText(formData.get(`applicant${number}MiddleName`), 100),
        lastName: cleanText(formData.get(`applicant${number}LastName`), 100),
        relation: cleanText(formData.get(`applicant${number}Relation`), 40),
        email: cleanText(formData.get(`applicant${number}Email`), 254),
        phone: cleanText(formData.get(`applicant${number}Phone`), 32),
      }));

    const checkoutConsent = formData.get("checkoutConsent") === "on";

    return {
      secret: appsScriptCompatibilityToken,
      submissionId,
      submittedAt: policyAgreedAt,
      formStartedAt: form.dataset.startedAt || "",
      website: window.location.hostname,
      companyWebsite: cleanText(honeypotField?.value, 100),
      consent: checkoutConsent,
      checkoutConsent,
      // Keep these derived fields until the deployed Apps Script is upgraded.
      serviceDisclaimer: checkoutConsent,
      contactAuthorization: checkoutConsent,
      policyConsent: checkoutConsent,
      marketingConsent: false,
      policyAgreedAt,
      policyVersion: "2026-09-30",
      paymentReference: submissionId,
      stripeClientReferenceId: submissionId,
      package: selectedPackage?.value || "single",
      packageLabel: selectedPackageLabel,
      applicantCount,
      firstName: cleanText(formData.get("firstName"), 100),
      middleName: cleanText(formData.get("middleName"), 100),
      lastName: cleanText(formData.get("lastName"), 100),
      email: cleanText(formData.get("email"), 254),
      phone: cleanText(formData.get("phone"), 32),
      countryOfBirth: cleanText(formData.get("country"), 100),
      applicants: [
        {
          applicantNumber: 1,
          role: "Primary",
          firstName: cleanText(formData.get("firstName"), 100),
          middleName: cleanText(formData.get("middleName"), 100),
          lastName: cleanText(formData.get("lastName"), 100),
          email: cleanText(formData.get("email"), 254),
          phone: cleanText(formData.get("phone"), 32),
          countryOfBirth: cleanText(formData.get("country"), 100),
        },
        ...additionalApplicants,
      ],
      paymentStatus: paymentStatus?.value || "pending",
      files,
    };
  };

  const requestSnapshot = (payload) => {
    const stable = { ...payload };
    for (const key of [
      "secret", "submissionId", "submittedAt", "formStartedAt", "policyAgreedAt",
      "paymentReference", "stripeClientReferenceId", "paymentStatus",
    ]) delete stable[key];
    // Comparison stays in this page's memory; no applicant data enters storage or analytics.
    return JSON.stringify(stable);
  };

  const sendApplicationToDrive = async (payload, snapshot) => {
    const request = fetch(googleScriptIntakeUrl, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
    });
    lastRequestSnapshot = snapshot;
    lastRequestResolved = false;
    retryAllowedAt = Date.now() + retryCooldownMs;
    trackConversion("request_dispatch", { form: "application" });
    try {
      await request;
      lastRequestResolved = true;
    } finally {
      // Start after settlement as server receipt can be later than browser dispatch.
      retryAllowedAt = Date.now() + retryCooldownMs;
    }
  };

  const updateSubmitLabel = () => {
    if (!submitButton || applicationPending) return;

    submitButton.textContent = "Send request & continue to Stripe";
  };

  const updatePackageSummary = () => {
    const selected = getSelectedStripePackage();
    const selectedKey = getSelectedPackage()?.value || "single";
    document.querySelectorAll("[data-package-select]").forEach((element) => {
      const isSelected = element.dataset.packageSelect === selectedKey;
      element.classList.toggle("is-selected", isSelected);
      element.setAttribute("aria-current", String(isSelected));
    });
    document.querySelectorAll("[data-package-name]").forEach((element) => {
      element.textContent = selected.label;
    });
    document.querySelectorAll("[data-package-price]").forEach((element) => {
      element.textContent = `$${selected.amount}`;
    });
  };

  const selectPackage = (packageKey, { focus = false, measure = true, keyboard = false } = {}) => {
    if (applicationPending) return false;
    if (typeof packageKey !== "string" || !Object.hasOwn(stripePackages, packageKey)) return false;
    const option = Array.from(packageOptions).find((radio) => radio.value === packageKey);
    if (!option || option.disabled) return false;
    option.checked = true;
    updateApplicantSections();
    updatePackageSummary();
    updateSubmitLabel();
    if (measure) trackConversion("select_item", { package: packageKey });
    if (focus) {
      const focusTarget = document.querySelector("#applicationFormTitle") ||
        form.querySelector('input:not([type="hidden"]):not([disabled])');
      // Keep the reading position accessible without outlining a heading after a tap.
      focusTarget?.classList.toggle("is-pointer-focus", !keyboard);
      focusTarget?.focus({ preventScroll: true });
      form.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        block: "start",
      });
    }
    return true;
  };

  const lockPackageSelection = (locked) => {
    if (locked) {
      committedSelection = {
        package: getSelectedPackage()?.value || "single",
        premiumCount: premiumApplicantCount?.value,
      };
      packageControls.forEach((control) => {
        previousDisabledStates.set(control, control.disabled);
        control.disabled = true;
      });
    } else {
      packageControls.forEach((control) => {
        if (previousDisabledStates.has(control)) control.disabled = previousDisabledStates.get(control);
      });
      previousDisabledStates.clear();
      committedSelection = null;
    }
    document.querySelectorAll("[data-package-select]").forEach((card) => {
      card.setAttribute("aria-disabled", String(locked));
    });
  };

  const restoreCommittedSelection = () => {
    if (!committedSelection) return;
    packageOptions.forEach((option) => {
      option.checked = option.value === committedSelection.package;
    });
    if (premiumApplicantCount) premiumApplicantCount.value = committedSelection.premiumCount;
    updateApplicantSections();
    updatePackageSummary();
  };

  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    applicationPending = false;
    lockPackageSelection(false);
    if (paymentStatus) paymentStatus.value = "pending";
    updateApplicantSections();
    updatePackageSummary();
    setSubmitState("idle");
    setFormMessage(
      "Your details are still here. Receipt and payment are not confirmed on this page. Check your Stripe receipt or contact support before paying again. Revised requests require a short cooldown; unchanged details can reopen Stripe without sending another request.",
      "info",
    );
  });

  const updateFileUploadSelection = () => {
    if (!identityDocumentInput || !fileUploadSelection) return;

    const selectedFiles = Array.from(identityDocumentInput.files || []);

    if (selectedFiles.length === 0) {
      fileUploadSelection.textContent = "No files selected";
    } else if (selectedFiles.length === 1) {
      fileUploadSelection.textContent = selectedFiles[0].name;
    } else {
      fileUploadSelection.textContent = `${selectedFiles.length} files selected`;
    }
  };

  const buildStripeCheckoutUrl = () => {
    const stripePackage = getSelectedStripePackage();

    if (!stripePackage.paymentLink) {
      throw new Error(
        `Secure checkout is not available for the ${stripePackage.label} package yet.`,
      );
    }

    const checkoutUrl = new URL(stripePackage.paymentLink);

    if (
      checkoutUrl.protocol !== "https:" ||
      checkoutUrl.hostname !== "buy.stripe.com"
    ) {
      throw new Error("Secure checkout is temporarily unavailable.");
    }

    const email = String(new FormData(form).get("email") || "").trim();
    checkoutUrl.searchParams.set("prefilled_email", email);
    checkoutUrl.searchParams.set("client_reference_id", getSubmissionId());

    return { checkoutUrl, stripePackage, packageKey: getSelectedPackage()?.value || "single" };
  };

  form.addEventListener("input", updateSubmitLabel);
  form.addEventListener("change", updateSubmitLabel);
  packageOptions.forEach((option) => {
    option.addEventListener("change", () => {
      if (applicationPending) {
        restoreCommittedSelection();
        return;
      }
      updateApplicantSections();
      updatePackageSummary();
      updateSubmitLabel();
      trackConversion("select_item", { package: option.value });
    });
  });
  premiumApplicantCount?.addEventListener("change", () => {
    if (applicationPending) {
      restoreCommittedSelection();
      return;
    }
    updateApplicantSections();
    updateSubmitLabel();
  });
  identityDocumentInput?.addEventListener("change", updateFileUploadSelection);
  updateApplicantSections();
  updatePackageSummary();
  updateSubmitLabel();
  updateFileUploadSelection();

  document.addEventListener("click", (event) => {
    const link = event.target.closest?.("[data-package-select]");
    if (!link) return;
    event.preventDefault();
    selectPackage(link.dataset.packageSelect, { focus: true, keyboard: event.detail === 0 });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.repeat) return;
    const link = event.target.closest?.("[data-package-select]");
    if (!link) return;
    // Keyboard-generated click details differ between browser engines.
    event.preventDefault();
    selectPackage(link.dataset.packageSelect, { focus: true, keyboard: true });
  });
  if (["/", "/index", "/index.html"].includes(window.location.pathname)) {
    const packageKey = new URLSearchParams(window.location.search).get("package");
    if (packageKey) selectPackage(packageKey, { focus: true, measure: false });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (applicationPending) return;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (honeypotField?.value) {
      setFormMessage("Submission could not be completed.", "error");
      return;
    }

    let checkout;

    try {
      checkout = buildStripeCheckoutUrl();
    } catch (error) {
      setFormMessage(
        error.message || "Secure checkout is temporarily unavailable.",
        "error",
      );
      return;
    }

    if (paymentStatus) {
      paymentStatus.value = "checkout-pending";
    }

    setSubmitState("submitting");
    applicationPending = true;
    setFormMessage(
      "Sending your preparation request before secure checkout. Please keep this page open.",
      "info",
    );

    try {
      const payloadPromise = buildApplicationPayload();
      // FormData is captured synchronously before package controls are disabled.
      lockPackageSelection(true);
      const payload = await payloadPromise;
      const snapshot = requestSnapshot(payload);
      const revised = lastRequestSnapshot !== null && snapshot !== lastRequestSnapshot;
      const needsDispatch = revised || !lastRequestResolved;
      if (needsDispatch && lastRequestSnapshot !== null && Date.now() < retryAllowedAt) {
        const seconds = Math.ceil((retryAllowedAt - Date.now()) / 1000);
        throw new Error(
          `Please wait ${seconds} seconds before sending another request. Receipt and payment are uncertain; check your Stripe receipt or contact support before paying again. Your details are still here.`,
        );
      }
      if (revised) {
        delete form.dataset.submissionId;
        const reference = getSubmissionId();
        payload.submissionId = reference;
        payload.paymentReference = reference;
        payload.stripeClientReferenceId = reference;
        checkout.checkoutUrl.searchParams.set("client_reference_id", reference);
      }
      if (needsDispatch) await sendApplicationToDrive(payload, snapshot);

      setSubmitState("redirecting");
      setFormMessage(
        needsDispatch
          ? `Preparation request sent, but receipt is unconfirmed. Opening secure Stripe checkout for the ${checkout.stripePackage.label} package.`
          : "Reopening Stripe without resending your unchanged request. Payment is unconfirmed here; do not pay again if you already have a Stripe receipt.",
        "info",
      );
      if (window.gcasAnalytics?.beginCheckout) {
        await window.gcasAnalytics.beginCheckout(checkout.packageKey);
      }
      window.location.assign(checkout.checkoutUrl.toString());
    } catch (error) {
      applicationPending = false;
      lockPackageSelection(false);
      if (paymentStatus) {
        paymentStatus.value = "pending";
      }
      setSubmitState("idle");
      setFormMessage(
        error.message ||
          "We could not send your preparation request, so payment was not opened. Please try again or contact support.",
        "error",
      );
    }
  });
}

if (notifyForm && notifyMessage) {
  notifyForm.dataset.startedAt = new Date().toISOString();

  const setNotifyMessage = (text, state = "info") => {
    notifyMessage.textContent = text;
    notifyMessage.classList.remove("is-info", "is-error", "is-success");
    if (text) notifyMessage.classList.add(`is-${state}`);
  };

  const setNotifyState = (state) => {
    if (!notifySubmitButton) return;

    notifySubmitButton.classList.toggle(
      "is-submitting",
      state === "submitting",
    );
    notifySubmitButton.classList.toggle("is-submitted", state === "submitted");
    notifySubmitButton.disabled =
      state === "submitting" || state === "submitted";

    if (state === "submitting") {
      notifySubmitButton.textContent = "Submitting...";
    } else if (state === "submitted") {
      notifySubmitButton.textContent = "Request sent";
    } else {
      notifySubmitButton.textContent = "Notify Me";
    }
  };

  const createNotificationId = () => {
    const random =
      window.crypto && "randomUUID" in window.crypto
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return `gcas-notify-${random}`;
  };

  const sendNotificationToDrive = async ({ email, phone, marketingConsent }) => {
    if (!googleScriptNotifyUrl) {
      throw new Error(
        "Notification collection is not connected yet. Please contact support or try again later.",
      );
    }

    const request = fetch(googleScriptNotifyUrl, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        secret: appsScriptCompatibilityToken,
        notificationId: createNotificationId(),
        submittedAt: new Date().toISOString(),
        formStartedAt: notifyForm.dataset.startedAt || "",
        website: window.location.hostname,
        sourcePage: window.location.pathname || "/",
        email,
        phone,
        notifyCompanyWebsite: cleanText(notifyHoneypotField?.value, 100),
        consent:
          "I agree to receive the requested DV registration opening notification by email or WhatsApp.",
        marketingConsent,
      }),
    });
    trackConversion("request_dispatch", { form: "notification" });
    await request;
  };

  let notificationPending = false;
  notifyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (notificationPending) return;

    const formData = new FormData(notifyForm);
    const email = cleanText(formData.get("notifyEmail"), 254);
    const phone = cleanText(formData.get("notifyPhone"), 32);

    if (notifyHoneypotField?.value) {
      setNotifyMessage("Notification request could not be completed.", "error");
      return;
    }

    if (!email && !phone) {
      trackConversion("validation_error", { form: "notification", category: "contact_required" });
      setNotifyMessage(
        "Enter an email or WhatsApp number so we can notify you.",
        "error",
      );
      return;
    }

    if (!notifyForm.checkValidity()) {
      notifyForm.reportValidity();
      return;
    }

    setNotifyState("submitting");
    notificationPending = true;
    setNotifyMessage(
      "Submitting your notification request. Please keep this window open.",
      "info",
    );

    try {
      await sendNotificationToDrive({
        email,
        phone,
        marketingConsent:
          formData.get("notifyMarketingConsent") === "on",
      });

      setNotifyState("submitted");
      setNotifyMessage(
        "Your notification request was sent. Delivery cannot be confirmed here; contact support if you need help.",
        "success",
      );
    } catch (error) {
      notificationPending = false;
      setNotifyState("idle");
      setNotifyMessage(
        error.message ||
          "We could not submit the notification request. Please try again.",
        "error",
      );
    }
  });
}

const initializeSupportWidget = () => {
  if (document.querySelector(".support-widget")) return;

  const createIcon = (name) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    const iconPaths = {
      message: [
        ["path", { d: "M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" }],
        ["path", { d: "M8 10h.01M12 10h.01M16 10h.01" }],
      ],
      mail: [
        ["rect", { x: "3", y: "5", width: "18", height: "14", rx: "2" }],
        ["path", { d: "m3 7 9 6 9-6" }],
      ],
      whatsapp: [
        ["path", { d: "M20.5 11.7a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.4-4.7A8.5 8.5 0 1 1 20.5 11.7Z" }],
        ["path", { d: "M8.2 7.7c.2-.5.4-.5.8-.5h.4c.2 0 .4.1.5.4l.9 2.1c.1.3.1.5-.1.7l-.7.9c-.2.2-.1.4 0 .6.7 1.2 1.7 2.2 3 2.8.2.1.4.1.6-.1l.9-1.1c.2-.2.4-.3.7-.2l2.1 1c.3.1.4.3.4.6 0 .4-.2 1.4-1 2-.7.6-1.7.8-2.7.5-1.2-.3-3.2-1.1-5-2.8-1.5-1.4-2.5-3.2-2.8-4.4-.3-1.1 0-1.9.3-2.5Z" }],
      ],
      help: [
        ["circle", { cx: "12", cy: "12", r: "9" }],
        ["path", { d: "M9.7 9a2.4 2.4 0 1 1 3.5 2.1c-.8.4-1.2.9-1.2 1.9" }],
        ["path", { d: "M12 17h.01" }],
      ],
      close: [
        ["path", { d: "m7 7 10 10M17 7 7 17" }],
      ],
    };

    iconPaths[name].forEach(([tagName, attributes]) => {
      const element = document.createElementNS(
        "http://www.w3.org/2000/svg",
        tagName,
      );
      Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
      svg.append(element);
    });

    return svg;
  };

  const widget = document.createElement("div");
  widget.className = "support-widget";

  const panel = document.createElement("section");
  panel.className = "support-panel";
  panel.id = "supportPanel";
  panel.hidden = true;
  panel.setAttribute("aria-labelledby", "supportPanelTitle");

  const panelHeader = document.createElement("div");
  panelHeader.className = "support-panel-header";
  const brandMark = document.createElement("span");
  brandMark.className = "support-brand-mark";
  brandMark.setAttribute("aria-hidden", "true");
  const panelTitle = document.createElement("strong");
  panelTitle.id = "supportPanelTitle";
  panelTitle.textContent = "Support";
  const closeButton = document.createElement("button");
  closeButton.className = "support-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close support panel");
  closeButton.append(createIcon("close"));
  panelHeader.append(brandMark, panelTitle, closeButton);

  const actions = document.createElement("div");
  actions.className = "support-actions";

  const createAction = ({ label, icon, href, channel, disabled = false }) => {
    const action = disabled
      ? document.createElement("button")
      : document.createElement("a");
    action.className = "support-action";
    if (disabled) {
      action.type = "button";
      action.disabled = true;
      action.setAttribute("aria-label", `${label}, coming soon`);
    } else {
      action.href = href;
      action.addEventListener("click", () =>
        trackConversion("support_action", { channel }));
    }

    const iconWrap = document.createElement("span");
    iconWrap.className = "support-action-icon";
    iconWrap.append(createIcon(icon));
    const labelWrap = document.createElement("span");
    labelWrap.className = "support-action-label";
    labelWrap.textContent = label;
    action.append(iconWrap, labelWrap);

    if (disabled) {
      const status = document.createElement("small");
      status.textContent = "Coming soon";
      action.append(status);
    }

    return action;
  };

  actions.append(
    createAction({
      label: "Email support",
      icon: "mail",
      channel: "email",
      href: "mailto:greencardapplicationservices@gmail.com?subject=Website%20support%20request",
    }),
    createAction({
      label: "WhatsApp",
      icon: "whatsapp",
      channel: "whatsapp",
      href: "https://wa.me/17547037991?text=Hello%20Green%20Card%20Application%20Services%2C%20I%20need%20support.",
    }),
    createAction({ label: "View FAQ", icon: "help", href: "/faq.html", channel: "faq" }),
  );
  panel.append(panelHeader, actions);

  const trigger = document.createElement("button");
  trigger.className = "support-trigger";
  trigger.type = "button";
  trigger.setAttribute("aria-label", "Open support");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-controls", panel.id);
  trigger.append(createIcon("message"));
  widget.append(panel, trigger);
  document.body.append(widget);

  const setOpen = (isOpen) => {
    panel.hidden = !isOpen;
    trigger.setAttribute("aria-expanded", String(isOpen));
    trigger.setAttribute("aria-label", isOpen ? "Hide support" : "Open support");
    widget.classList.toggle("is-open", isOpen);
    if (isOpen) closeButton.focus();
  };

  trigger.addEventListener("click", () => {
    if (panel.hidden) trackConversion("support_open");
    setOpen(panel.hidden);
  });
  closeButton.addEventListener("click", () => {
    setOpen(false);
    trigger.focus();
  });
  document.addEventListener("click", (event) => {
    if (!panel.hidden && !widget.contains(event.target)) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      setOpen(false);
      trigger.focus();
    }
  });
};

const initializeCookiePreferences = () => {
  const consentApi = window.gcasConsent;
  if (!consentApi) return;

  const preferenceButtons = document.querySelectorAll(
    "[data-cookie-preferences]",
  );
  const root = document.createElement("div");
  root.className = "cookie-consent";

  const banner = document.createElement("section");
  banner.className = "cookie-banner";
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-label", "Cookie preferences");

  const bannerCopy = document.createElement("div");
  const bannerTitle = document.createElement("strong");
  bannerTitle.textContent = "Your privacy choices";
  const bannerText = document.createElement("p");
  bannerText.append(
    "We use essential storage and, with your permission, analytics and advertising technologies. ",
  );
  const cookiePolicyLink = document.createElement("a");
  cookiePolicyLink.href = "/policies#cookies";
  cookiePolicyLink.textContent = "Cookie Policy";
  bannerText.append(cookiePolicyLink, ".");
  bannerCopy.append(bannerTitle, bannerText);

  const bannerActions = document.createElement("div");
  bannerActions.className = "cookie-actions";

  const makeButton = (label, className) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    return button;
  };

  const rejectButton = makeButton(
    "Reject nonessential",
    "button button-secondary",
  );
  const customizeButton = makeButton(
    "Customize",
    "button button-secondary",
  );
  const acceptButton = makeButton("Accept all", "button");
  bannerActions.append(rejectButton, customizeButton, acceptButton);
  banner.append(bannerCopy, bannerActions);

  const backdrop = document.createElement("div");
  backdrop.className = "cookie-dialog-backdrop";
  backdrop.hidden = true;

  const dialog = document.createElement("section");
  dialog.className = "cookie-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "cookieDialogTitle");

  const dialogHeader = document.createElement("div");
  dialogHeader.className = "cookie-dialog-header";
  const dialogHeading = document.createElement("div");
  const dialogTitle = document.createElement("h2");
  dialogTitle.id = "cookieDialogTitle";
  dialogTitle.textContent = "Cookie preferences";
  const dialogIntro = document.createElement("p");
  dialogIntro.textContent =
    "Choose which optional technologies may be used. Essential security and consent storage remain active.";
  dialogHeading.append(dialogTitle, dialogIntro);
  const closeButton = makeButton("Close", "cookie-dialog-close");
  closeButton.setAttribute("aria-label", "Close cookie preferences");
  dialogHeader.append(dialogHeading, closeButton);

  const options = document.createElement("div");
  options.className = "cookie-options";

  const createOption = ({ title, description, name, required = false }) => {
    const row = document.createElement("label");
    row.className = "cookie-option";
    const copy = document.createElement("span");
    const heading = document.createElement("strong");
    heading.textContent = title;
    const detail = document.createElement("small");
    detail.textContent = description;
    copy.append(heading, detail);

    if (required) {
      const status = document.createElement("span");
      status.className = "cookie-required";
      status.textContent = "Always active";
      row.append(copy, status);
      return { row, input: null };
    }

    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = name;
    row.append(copy, input);
    return { row, input };
  };

  const essential = createOption({
    title: "Essential and security",
    description:
      "Needed for security, payments, form operation, and remembering your privacy choice.",
    required: true,
  });
  const preferences = createOption({
    title: "Preferences",
    description: "Allows optional settings that make the site more convenient.",
    name: "preferences",
  });
  const analytics = createOption({
    title: "Analytics",
    description: "Helps us understand site use and improve performance.",
    name: "analytics",
  });
  const advertising = createOption({
    title: "Advertising",
    description: "Helps measure campaigns and show more relevant advertising.",
    name: "advertising",
  });
  options.append(
    essential.row,
    preferences.row,
    analytics.row,
    advertising.row,
  );

  const dialogActions = document.createElement("div");
  dialogActions.className = "cookie-dialog-actions";
  const saveButton = makeButton("Save preferences", "button");
  dialogActions.append(saveButton);
  dialog.append(dialogHeader, options, dialogActions);
  backdrop.append(dialog);
  root.append(banner, backdrop);
  document.body.append(root);

  const hideBanner = () => {
    banner.hidden = true;
  };

  const closeDialog = () => {
    backdrop.hidden = true;
    document.body.classList.remove("cookie-dialog-open");
  };

  const openDialog = () => {
    const saved = consentApi.get() || {};
    preferences.input.checked = Boolean(saved.preferences);
    analytics.input.checked = Boolean(saved.analytics);
    advertising.input.checked = Boolean(saved.advertising);
    backdrop.hidden = false;
    document.body.classList.add("cookie-dialog-open");
    closeButton.focus();
  };

  const saveConsent = (value) => {
    consentApi.save(value);
    hideBanner();
    closeDialog();
  };

  acceptButton.addEventListener("click", () => {
    saveConsent({ preferences: true, analytics: true, advertising: true });
  });
  rejectButton.addEventListener("click", () => {
    saveConsent({ preferences: false, analytics: false, advertising: false });
  });
  customizeButton.addEventListener("click", openDialog);
  closeButton.addEventListener("click", closeDialog);
  saveButton.addEventListener("click", () => {
    saveConsent({
      preferences: preferences.input.checked,
      analytics: analytics.input.checked,
      advertising: advertising.input.checked,
    });
  });
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeDialog();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !backdrop.hidden) closeDialog();
  });
  preferenceButtons.forEach((button) => {
    button.addEventListener("click", openDialog);
  });

  if (consentApi.get()) hideBanner();
};

initializeSupportWidget();
initializeCookiePreferences();
