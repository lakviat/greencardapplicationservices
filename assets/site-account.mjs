import { observeSession } from "./preparation/backend.mjs?v=20261019-workspace-v39";
import { accountControl } from "./preparation/account-control.mjs?v=20261019-workspace-v39";

// The same Auth client and activity policy runs on every public page. Never
// pass account/profile information to the separate public-page analytics code.
const header = document.querySelector(".site-header, [data-account-header]");
if (header) {
  let account;
  const profile = accountControl(async () => {
    await ready;
    location.assign(account ? "/prepare.html#account" : "/prepare.html#signin");
  });
  header.append(profile.node);
  const ready = observeSession((session) => {
    account = session?.user || null;
    profile.update(account);
  }).catch(() => {
    profile.update(null);
    profile.node.title =
      "Account connection unavailable. Open your preparations to retry.";
  });
}
