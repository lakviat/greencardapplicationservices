// Run daily with the project secret in an environment secret store, never in Git.
import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key)
  throw new Error(
    "Set SUPABASE_URL and SUPABASE_SECRET_KEY in the server environment.",
  );
const db = createClient(url, key, { auth: { persistSession: false } }),
  storage = db.storage.from("gcas-private");
const ok = (r) => {
  if (r.error)
    throw new Error(
      "Private-storage maintenance failed; check the provider dashboard.",
    );
  return r.data;
};
ok(await db.rpc("gcas_expire"));
let removed = 0;
for (;;) {
  const rows = ok(
    await db.from("gcas_storage_cleanup").select("object_path").limit(100),
  );
  if (!rows.length) break;
  ok(await storage.remove(rows.map((r) => r.object_path)));
  ok(
    await db
      .from("gcas_storage_cleanup")
      .delete()
      .in(
        "object_path",
        rows.map((r) => r.object_path),
      ),
  );
  removed += rows.length;
}
// Crash recovery: files written before their metadata transaction are not retained.
async function walk(prefix = "") {
  let offset = 0;
  const entries = [];
  for (;;) {
    const page = ok(
      await storage.list(prefix, {
        limit: 1000,
        offset,
        sortBy: { column: "name", order: "asc" },
      }),
    );
    entries.push(...page);
    if (page.length < 1000) break;
    offset += page.length;
  }
  for (const item of entries) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (!item.id) {
      await walk(path);
      continue;
    }
    if (Date.parse(item.created_at) > Date.now() - 86400000) continue;
    const metadata = ok(
      await db
        .from("gcas_assets")
        .select("id")
        .eq("object_path", path)
        .maybeSingle(),
    );
    if (!metadata) {
      ok(await storage.remove([path]));
      removed++;
    }
  }
}
await walk();
console.log(
  `Private-storage maintenance complete; ${removed} expired or orphaned files removed.`,
);
