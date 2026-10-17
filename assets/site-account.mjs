import { observeSession } from "./preparation/backend.mjs?v=20261017-workspace-v30";
import { accountControl } from "./preparation/account-control.mjs?v=20261017-workspace-v30";

// The same Auth client and activity policy runs on every public page. Never
// pass account/profile information to the separate public-page analytics code.
const header = document.querySelector(".site-header, [data-account-header]");
if (header) {
  const profile = accountControl(() =>
    location.assign("/prepare.html#account"),
  );
  header.append(profile.node);
  observeSession((session) => profile.update(session?.user || null)).catch(
    () => {
      profile.node.title =
        "Account connection unavailable. Open your preparations to retry.";
    },
  );
}
