const form = document.querySelector("#intakeForm");
const message = document.querySelector("#formMessage");
const submitButton = document.querySelector("#applicationSubmit");
const applePayButton = document.querySelector("#applePayButton");
const paymentStatus = document.querySelector("#paymentStatus");
const packageOptions = document.querySelectorAll('input[name="package"]');
const premiumCountField = document.querySelector("#premiumCountField");
const premiumApplicantCount = document.querySelector("#premiumApplicantCount");
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
const honeypotField = document.querySelector("#companyWebsite");
const googleScriptIntakeUrl =
  "https://script.google.com/macros/s/AKfycbyZp6oqQoPsP6o2RwaFlflHgfF9QAfjtlp172XQZCqEUnV3g3YiwmBYoW0HoFIwN9kv/exec";
const googleScriptNotifyUrl =
  "https://script.google.com/macros/s/AKfycbzfG-PHP8OR4qR6YGP1dcJ9eXQ8Crrg9ag1jG_WonTdGpwRVcsL5TMDfQADyqnyMg60/exec";
const googleScriptPublicToken = "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET";
const maxFiles = 8;
const maxFileSize = 15 * 1024 * 1024;
const maxTotalUploadSize = 35 * 1024 * 1024;
const faqGroups = document.querySelectorAll("[data-faq-accordion]");
const countdownPanel = document.querySelector("[data-dv-countdown]");

if (countdownPanel) {
  const targetValue = countdownPanel.dataset.countdownDate?.trim();
  const targetDate = targetValue ? new Date(targetValue) : null;
  const isEstimated = countdownPanel.dataset.countdownStatus === "estimated";
  const heading = countdownPanel.querySelector("[data-countdown-heading]");
  const description = countdownPanel.querySelector(
    "[data-countdown-description]",
  );
  const chip = countdownPanel.querySelector("[data-countdown-chip]");
  const values = {
    days: countdownPanel.querySelector('[data-countdown-value="days"]'),
    hours: countdownPanel.querySelector('[data-countdown-value="hours"]'),
    minutes: countdownPanel.querySelector('[data-countdown-value="minutes"]'),
    seconds: countdownPanel.querySelector('[data-countdown-value="seconds"]'),
  };

  if (targetDate && !Number.isNaN(targetDate.getTime())) {
    countdownPanel.classList.add("is-active");
    chip.textContent = isEstimated
      ? "Estimated opening date"
      : "Official opening date confirmed";
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
      values.minutes.textContent = String(
        Math.floor((totalSeconds % 3600) / 60),
      ).padStart(2, "0");
      values.seconds.textContent = String(totalSeconds % 60).padStart(2, "0");

      if (remaining === 0) {
        chip.textContent = "Registration period status";
        heading.textContent = isEstimated
          ? "The estimated opening time has arrived."
          : "The official opening time has arrived.";
        description.textContent = isEstimated
          ? "Check the official Department of State website before submitting an entry."
          : "The official DV registration period is scheduled to be open.";
        window.clearInterval(countdownTimer);
      }
    };

    countdownTimer = window.setInterval(updateCountdown, 1000);
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
    submitButton.classList.toggle("is-submitted", state === "submitted");
    submitButton.disabled = state === "submitting" || state === "submitted";

    if (state === "submitting") {
      submitButton.textContent = "Submitting...";
    } else if (state === "submitted") {
      submitButton.textContent = "Submitted";
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

  const createSubmissionId = () => {
    const random =
      window.crypto && "randomUUID" in window.crypto
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return `gcas-${random}`;
  };

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

    const files = await Promise.all(uploadedFiles.map(fileToPayload));
    const additionalApplicants = [2, 3]
      .filter((number) => number <= applicantCount)
      .map((number) => ({
        applicantNumber: number,
        firstName: formData.get(`applicant${number}FirstName`) || "",
        middleName: formData.get(`applicant${number}MiddleName`) || "",
        lastName: formData.get(`applicant${number}LastName`) || "",
        relation: formData.get(`applicant${number}Relation`) || "",
        email: formData.get(`applicant${number}Email`) || "",
        phone: formData.get(`applicant${number}Phone`) || "",
      }));

    return {
      secret: googleScriptPublicToken,
      submissionId: createSubmissionId(),
      submittedAt: new Date().toISOString(),
      formStartedAt: form.dataset.startedAt || "",
      website: window.location.hostname,
      package: selectedPackage?.value || "single",
      packageLabel: selectedPackageLabel,
      applicantCount,
      firstName: formData.get("firstName"),
      middleName: formData.get("middleName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      countryOfBirth: formData.get("country"),
      applicants: [
        {
          applicantNumber: 1,
          role: "Primary",
          firstName: formData.get("firstName") || "",
          middleName: formData.get("middleName") || "",
          lastName: formData.get("lastName") || "",
          email: formData.get("email") || "",
          phone: formData.get("phone") || "",
          countryOfBirth: formData.get("country") || "",
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

    submitButton.textContent = form.checkValidity()
      ? "Submit Application"
      : "Start Application";
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
  updateApplicantSections();
  updateSubmitLabel();

  if (applePayButton) {
    applePayButton.addEventListener("click", () => {
      if (!form.checkValidity()) {
        form.reportValidity();
        message.textContent =
          "Complete the required application fields before continuing to payment.";
        message.style.color = "#b42318";
        return;
      }

      if (paymentStatus) {
        paymentStatus.value = "payment-link-pending";
      }

      message.textContent =
        "Secure checkout links are being updated for the new packages. You can submit the request now and we will confirm payment next.";
      message.style.color = "#174ea6";
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (honeypotField?.value) {
      message.textContent = "Submission could not be completed.";
      message.style.color = "#b42318";
      return;
    }

    setSubmitState("submitting");
    message.textContent =
      "Submitting your application and uploaded document. Please keep this page open.";
    message.style.color = "#174ea6";

    try {
      await sendApplicationToDrive();

      setSubmitState("submitted");
      message.textContent =
        "Submitted. We received your request and will contact you to confirm documents, package, and payment before staff review begins.";
      message.style.color = "#188038";
    } catch (error) {
      setSubmitState("idle");
      message.textContent =
        error.message ||
        "We could not submit the application. Please try again or contact support.";
      message.style.color = "#b42318";
    }
  });
}

if (notifyForm && notifyMessage) {
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
        secret: googleScriptPublicToken,
        notificationId: createNotificationId(),
        submittedAt: new Date().toISOString(),
        website: window.location.hostname,
        sourcePage: window.location.pathname || "/",
        email,
        phone,
        consent:
          "I agree to be contacted about DV registration updates and application support.",
      }),
    });
  };

  notifyForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(notifyForm);
    const email = String(formData.get("notifyEmail") || "").trim();
    const phone = String(formData.get("notifyPhone") || "").trim();

    if (!email && !phone) {
      notifyMessage.textContent =
        "Enter an email or WhatsApp number so we can notify you.";
      notifyMessage.style.color = "#b42318";
      return;
    }

    if (!notifyForm.checkValidity()) {
      notifyForm.reportValidity();
      return;
    }

    setNotifyState("submitting");
    notifyMessage.textContent =
      "Submitting your notification request. Please keep this window open.";
    notifyMessage.style.color = "#174ea6";

    try {
      await sendNotificationToDrive({ email, phone });

      setNotifyState("submitted");
      notifyMessage.textContent =
        "Thank you for staying up to date with Green Card Application Services. We will contact you when DV registration opens.";
      notifyMessage.style.color = "#188038";
    } catch (error) {
      setNotifyState("idle");
      notifyMessage.textContent =
        error.message ||
        "We could not submit the notification request. Please try again.";
      notifyMessage.style.color = "#b42318";
    }
  });
}
