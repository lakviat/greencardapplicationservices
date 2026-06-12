const form = document.querySelector("#intakeForm");
const message = document.querySelector("#formMessage");
const submitButton = document.querySelector("#applicationSubmit");
const applePayButton = document.querySelector("#applePayButton");
const paymentStatus = document.querySelector("#paymentStatus");
const mobileMenus = document.querySelectorAll(".mobile-menu");
const applySection = document.querySelector("#apply");

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

if (applySection && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    ([entry]) => {
      document.body.classList.toggle("apply-visible", entry.isIntersecting);
    },
    { threshold: 0.12 },
  );

  observer.observe(applySection);
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
      if (paymentStatus) {
        paymentStatus.value = "apple-pay-test-confirmed";
      }

      applePayButton.classList.add("is-confirmed");
      applePayButton.innerHTML =
        "<span>Payment confirmed</span><strong>Test mode</strong>";
      message.textContent =
        "Apple Pay test payment confirmed for this preview. Live checkout still needs a secure payment provider and backend.";
      message.style.color = "#174ea6";
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    message.textContent =
      "Application request saved in this preview. Next step: connect secure intake, uploads, payment, and staff review.";
    message.style.color = "#174ea6";
  });
}
