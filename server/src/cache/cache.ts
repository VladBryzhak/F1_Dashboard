import NodeCache from "node-cache";

// Shared in-memory TTL cache. Jolpica is volunteer-run and rate-limited, so we
// cache normalized responses to stay well under its limits. Standings/calendar
// change rarely, so a generous default TTL is fine.
const store = new NodeCache({ stdTTL: 60 * 60, checkperiod: 120 });

/**
 * Returns the cached value for `key`, or computes it with `producer`, caches it,
 * and returns it. Concurrent callers for a cold key will each call `producer`;
 * that's acceptable for our low traffic.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  producer: () => Promise<T>
): Promise<T> {
  const hit = store.get<T>(key);
  if (hit !== undefined) return hit;
  const value = await producer();
  store.set(key, value, ttlSeconds);
  return value;
}
