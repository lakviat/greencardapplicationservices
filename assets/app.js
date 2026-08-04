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
    amount: 39,
    paymentLink: "https://buy.stripe.com/14A3cx3BAgBp4pF4uo0Ny01",
  },
  couple: {
    label: "Couple",
    amount: 69,
    paymentLink: "https://buy.stripe.com/eVq9AV2xw70PcWbgd60Ny02",
  },
  family: {
    label: "Family",
    amount: 99,
    paymentLink: "https://buy.stripe.com/cNi7sN4FE5WL7BR8KE0Ny03",
  },
  premium: {
    label: "Premium",
    amount: 149,
    paymentLink: "https://buy.stripe.com/cNieVf1tsbh509p2mg0Ny04",
  },
};

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
    days: countdownPanel.querySelector('[data-countdown-value="days"]'),
    hours: countdownPanel.querySelector('[data-countdown-value="hours"]'),
  };

  if (targetDate && !Number.isNaN(targetDate.getTime())) {
    countdownPanel.classList.add("is-active");
    heading.textContent = isEstimated
      ? "Estimated registration opening in:"
      : "Registration opens in:";
    description.textContent = isEstimated
      ? "Planning estimate: Wednesday, October 7, 2026 at 12:00 PM Eastern. The Department of State has not announced the official DV-2027 registration dates yet."
      : "The countdown uses the official Department of State opening time.";
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

      if (remaining === 0) {
        heading.textContent = isEstimated
          ? "The estimated opening time has arrived."
          : "The official opening time has arrived.";
        description.textContent = isEstimated
          ? "Check the official Department of State website before submitting an entry."
          : "The official DV registration period is scheduled to be open.";
        window.clearInterval(countdownTimer);
      }
    };

    countdownTimer = window.setInterval(updateCountdown, 60000);
    updateCountdown();
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
    return stripePackages[packageKey] || stripePackages.single;
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
      submitButton.textContent = "Submitting application...";
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
      throw new Error(`Upload up to ${maxFiles} files at a time.`);
    }

    if (uploadedFiles.some((file) => file.size > maxFileSize)) {
      throw new Error(
        "One of the selected files is too large. Please keep each file under 15 MB.",
      );
    }

    if (totalUploadSize > maxTotalUploadSize) {
      throw new Error(
        "The selected files are too large together. Please keep the total upload under 35 MB.",
      );
    }

    if (uploadedFiles.some((file) => !isAllowedUpload(file))) {
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
      policyAgreedAt,
      policyVersion: "2026-08-04",
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

  const sendApplicationToDrive = async () => {
    const payload = await buildApplicationPayload();

    await fetch(googleScriptIntakeUrl, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
    });
  };

  const updateSubmitLabel = () => {
    if (!submitButton) return;

    submitButton.textContent = "Submit & Continue to Payment";
  };

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

    return { checkoutUrl, stripePackage };
  };

  form.addEventListener("input", updateSubmitLabel);
  form.addEventListener("change", updateSubmitLabel);
  packageOptions.forEach((option) => {
    option.addEventListener("change", () => {
      updateApplicantSections();
      updateSubmitLabel();
    });
  });
  premiumApplicantCount?.addEventListener("change", () => {
    updateApplicantSections();
    updateSubmitLabel();
  });
  identityDocumentInput?.addEventListener("change", updateFileUploadSelection);
  updateApplicantSections();
  updateSubmitLabel();
  updateFileUploadSelection();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

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
    setFormMessage(
      "Submitting your application before secure checkout. Please keep this page open.",
      "info",
    );

    try {
      await sendApplicationToDrive();

      setSubmitState("redirecting");
      setFormMessage(
        `Application sent. Opening secure Stripe checkout for the ${checkout.stripePackage.label} package.`,
        "info",
      );
      window.location.assign(checkout.checkoutUrl.toString());
    } catch (error) {
      if (paymentStatus) {
        paymentStatus.value = "pending";
      }
      setSubmitState("idle");
      setFormMessage(
        error.message ||
          "We could not submit the application, so payment was not opened. Please try again or contact support.",
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
      notifySubmitButton.textContent = "Submitted";
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

    await fetch(googleScriptNotifyUrl, {
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
  };

  notifyForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(notifyForm);
    const email = cleanText(formData.get("notifyEmail"), 254);
    const phone = cleanText(formData.get("notifyPhone"), 32);

    if (notifyHoneypotField?.value) {
      setNotifyMessage("Notification request could not be completed.", "error");
      return;
    }

    if (!email && !phone) {
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
        "Thank you for staying up to date with Green Card Application Services. We will contact you when DV registration opens.",
        "success",
      );
    } catch (error) {
      setNotifyState("idle");
      setNotifyMessage(
        error.message ||
          "We could not submit the notification request. Please try again.",
        "error",
      );
    }
  });
}

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

initializeCookiePreferences();
