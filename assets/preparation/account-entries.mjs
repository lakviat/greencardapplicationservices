// Account summaries live only in this page's memory. A different user, logout
// or idle expiry discards them; answers and images never enter this cache.
export function accountEntries(read, { now = Date.now, ttl = 30000 } = {}) {
  let owner, records, checkedAt, pending;
  let generation = 0;
  let version = 0;
  const changes = new Map();
  const listeners = new Set();
  const snapshot = () =>
    records && {
      preparations: records.filter(
        (p) => !p.expires_at || Date.parse(p.expires_at) > now(),
      ),
    };
  const notify = () => listeners.forEach((listener) => listener(snapshot()));
  return {
    snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setOwner(next) {
      if (owner === next) return;
      owner = next;
      generation++;
      version++;
      records = checkedAt = pending = undefined;
      changes.clear();
      notify();
    },
    async refresh({ force = false } = {}) {
      if (!owner) throw new Error("Sign in to continue.");
      if (pending) return pending;
      if (!force && records && checkedAt && now() - checkedAt < ttl)
        return snapshot();
      const current = generation;
      const started = version;
      const operation = (async () => {
        const result = await read();
        if (current !== generation)
          throw new Error("Your account changed. Please try again.");
        // An older list response must never undo a save/deletion in this tab.
        const newer = [...changes].filter(
          ([, change]) => change.version > started,
        );
        const ids = new Set(newer.map(([id]) => id));
        records = result.preparations.filter((p) => !ids.has(p.id));
        for (const [, change] of newer)
          if (change.value) records.push(change.value);
        checkedAt = started === version ? now() : undefined;
        for (const [id, change] of changes)
          if (change.version <= started) changes.delete(id);
        notify();
        return snapshot();
      })();
      pending = operation;
      try {
        return await operation;
      } finally {
        if (pending === operation) pending = undefined;
      }
    },
    update(id, value, expectedOwner = owner) {
      if (!owner || owner !== expectedOwner) return;
      version++;
      changes.set(id, { version, value });
      checkedAt = undefined;
      records = (records || []).filter((p) => p.id !== id);
      if (value) records.push(value);
      notify();
    },
  };
}
