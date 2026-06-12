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

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    message.textContent =
      "Application request prepared. Payment is optional at this step; our team can reach out to confirm documents and next steps.";
    message.style.color = "#188038";

    if (submitButton) {
      submitButton.textContent = "Application Prepared";
    }
  });
}
