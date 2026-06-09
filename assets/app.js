const form = document.querySelector("#intakeForm");
const message = document.querySelector("#formMessage");

if (form && message) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const email = String(data.get("email") || "")
      .trim()
      .toLowerCase();
    const confirmEmail = String(data.get("confirmEmail") || "")
      .trim()
      .toLowerCase();

    if (email !== confirmEmail) {
      message.textContent = "Please make sure both email fields match.";
      message.style.color = "#c5221f";
      return;
    }

    message.textContent =
      "Application request saved in this preview. Next step: connect secure intake, uploads, payment, and staff review.";
    message.style.color = "#174ea6";
  });
}
