const form = document.querySelector("#intakeForm");
const message = document.querySelector("#formMessage");
const submitButton = document.querySelector("#applicationSubmit");
const applePayButton = document.querySelector("#applePayButton");
const paymentStatus = document.querySelector("#paymentStatus");
const mobileMenus = document.querySelectorAll(".mobile-menu");
const applySection = document.querySelector("#apply");
const heroSection = document.querySelector(".hero-dashboard");
const oneSubmissionCheckoutUrl =
  "https://buy.stripe.com/test_14AaEZ7PucMefqAbmJ0ZW00";
const googleScriptIntakeUrl =
  "https://script.google.com/macros/s/AKfycbyZp6oqQoPsP6o2RwaFlflHgfF9QAfjtlp172XQZCqEUnV3g3YiwmBYoW0HoFIwN9kv/exec";
const googleScriptSecret = "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET";

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
    const uploadedFiles = formData
      .getAll("identityDocument")
      .filter((file) => file instanceof File && file.size > 0);
    const files = await Promise.all(uploadedFiles.map(fileToPayload));

    return {
      secret: googleScriptSecret,
      submissionId: createSubmissionId(),
      submittedAt: new Date().toISOString(),
      firstName: formData.get("firstName"),
      middleName: formData.get("middleName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      countryOfBirth: formData.get("countryOfBirth"),
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
        paymentStatus.value = "stripe-checkout-started";
      }

      message.textContent =
        "Opening secure Stripe checkout for the $100 one-submission package.";
      message.style.color = "#174ea6";

      window.location.href = oneSubmissionCheckoutUrl;
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
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
