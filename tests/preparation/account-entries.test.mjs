import { test } from "node:test";
import assert from "node:assert/strict";
import { accountEntries } from "../../assets/preparation/account-entries.mjs";

test("repeated visits share one request and reuse fresh summaries only in memory", async () => {
  let calls = 0,
    release,
    now = 100;
  const store = accountEntries(
    () => {
      calls++;
      return new Promise((r) => (release = r));
    },
    { now: () => now },
  );
  store.setOwner("a");
  const first = store.refresh(),
    second = store.refresh();
  assert.equal(calls, 1);
  release({ preparations: [{ id: "saved" }] });
  await Promise.all([first, second]);
  await store.refresh();
  assert.equal(calls, 1);
  now += 30001;
  const stale = store.refresh();
  assert.deepEqual(store.snapshot(), { preparations: [{ id: "saved" }] });
  release({ preparations: [] });
  await stale;
  assert.deepEqual(store.snapshot(), { preparations: [] });
});

test("late list results cannot undo a confirmed save or restore a deleted entry", async () => {
  let release;
  const store = accountEntries(() => new Promise((r) => (release = r)));
  store.setOwner("a");
  const reading = store.refresh();
  store.update("saved", { id: "saved", revision: 2 }, "a");
  store.update("deleted", null, "a");
  release({
    preparations: [
      { id: "saved", revision: 1 },
      { id: "older" },
      { id: "deleted" },
    ],
  });
  await reading;
  assert.deepEqual(store.snapshot().preparations, [
    { id: "older" },
    { id: "saved", revision: 2 },
  ]);
});

test("logout, account changes, late writes and expired records cannot expose another account", async () => {
  let release;
  const store = accountEntries(() => new Promise((r) => (release = r)), {
    now: () => 100,
  });
  store.setOwner("a");
  const old = store.refresh();
  store.setOwner("b");
  assert.equal(store.snapshot(), undefined);
  store.update("private-a", { id: "private-a" }, "a");
  assert.equal(store.snapshot(), undefined);
  release({ preparations: [{ id: "private-a" }] });
  await assert.rejects(old, /account changed/);
  store.update(
    "expired",
    { id: "expired", expires_at: new Date(50).toISOString() },
    "b",
  );
  assert.deepEqual(store.snapshot().preparations, []);
  store.setOwner(undefined);
  assert.equal(store.snapshot(), undefined);
  await assert.rejects(store.refresh(), /Sign in/);
});

test("a failed revalidation preserves the last loaded card and can be retried", async () => {
  let fail = true;
  const store = accountEntries(async () => {
    if (fail) throw Error("offline");
    return { preparations: [] };
  });
  store.setOwner("a");
  store.update("saved", { id: "saved" });
  await assert.rejects(store.refresh(), /offline/);
  assert.equal(store.snapshot().preparations[0].id, "saved");
  fail = false;
  await store.refresh();
  assert.deepEqual(store.snapshot().preparations, []);
});
