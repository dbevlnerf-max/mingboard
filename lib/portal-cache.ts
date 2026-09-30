type Entry = { data: unknown; updatedAt: number };
const entries = new Map<string, Entry>();
const maxAge = 5 * 60 * 1000;

// Memory only: no guild or distribution data is persisted on a shared device.
export function readPortalCache<T>(key: string): { data: T; updatedAt: number } | undefined {
  const entry = entries.get(key);
  if (!entry) return;
  if (Date.now() - entry.updatedAt > maxAge) {
    entries.delete(key);
    return;
  }
  return entry as { data: T; updatedAt: number };
}

export function writePortalCache(key: string, data: unknown, updatedAt: number) {
  entries.delete(key);
  entries.set(key, { data, updatedAt });
  while (entries.size > 30) entries.delete(entries.keys().next().value!);
}

export function clearPortalCache(scope?: string) {
  if (!scope) entries.clear();
  else for (const key of entries.keys()) {
    if (key.startsWith(`${scope}\n`)) entries.delete(key);
  }
}
