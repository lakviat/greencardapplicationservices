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
const mobileMenus = document.querySelectorAll(".mobile-menu");
const applySection = document.querySelector("#apply");
const heroSection = document.querySelector(".hero-dashboard");
const honeypotField = document.querySelector("#companyWebsite");
const googleScriptIntakeUrl =
  "https://script.google.com/macros/s/AKfycbyZp6oqQoPsP6o2RwaFlflHgfF9QAfjtlp172XQZCqEUnV3g3YiwmBYoW0HoFIwN9kv/exec";
const googleScriptPublicToken = "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET";
const maxFiles = 8;
const maxFileSize = 15 * 1024 * 1024;
const maxTotalUploadSize = 35 * 1024 * 1024;

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
  notifyForm.addEventListener("submit", (event) => {
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

    notifyMessage.textContent =
      "Notification request prepared. We will connect this to the notification list next.";
    notifyMessage.style.color = "#188038";
  });
}
