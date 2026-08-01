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
const stripePackages = {
  single: {
    label: "Single",
    amount: 39,
    paymentLink: "https://buy.stripe.com/test_6oUdRbd9OaE6disfCZ0ZW01",
  },
  couple: {
    label: "Couple",
    amount: 69,
    paymentLink: "https://buy.stripe.com/test_bJe9AVd9O7rUemwgH30ZW02",
  },
  family: {
    label: "Family",
    amount: 99,
    paymentLink: "https://buy.stripe.com/test_6oUdRbedS27A3HSeyV0ZW03",
  },
  premium: {
    label: "Premium",
    amount: 149,
    paymentLink: "https://buy.stripe.com/test_dRm4gBb1GcMeguEcqN0ZW04",
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

    return {
      secret: appsScriptCompatibilityToken,
      submissionId: getSubmissionId(),
      submittedAt: new Date().toISOString(),
      formStartedAt: form.dataset.startedAt || "",
      website: window.location.hostname,
      companyWebsite: cleanText(honeypotField?.value, 100),
      consent: true,
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

  const sendNotificationToDrive = async ({ email, phone }) => {
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
          "I agree to be contacted about DV registration updates and application support.",
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
      await sendNotificationToDrive({ email, phone });

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
