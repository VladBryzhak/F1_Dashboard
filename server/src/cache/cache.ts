import NodeCache from "node-cache";

// Shared in-memory TTL cache for normalized upstream responses, so pages
// don't call OpenF1 (whose free tier allows 30 requests a minute) or other
// sources again for data that hasn't changed.
const store = new NodeCache({ stdTTL: 60 * 60, checkperiod: 120 });
// Values being computed: concurrent callers for a cold key share one
// producer run (two visitors opening the same replay make one set of
// upstream requests, not two).
const pending = new Map<string, Promise<unknown>>();

/**
 * Returns the cached value for `key`, or computes it with `producer`, caches it,
 * and returns it. `ttlSeconds` may depend on the value (a finished session's
 * data keeps for hours, a running one's for seconds; a result missing a part
 * for a minute). A failed producer caches nothing.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number | ((value: T) => number),
  producer: () => Promise<T>
): Promise<T> {
  const hit = store.get<T>(key);
  if (hit !== undefined) return hit;
  const running = pending.get(key);
  if (running) return running as Promise<T>;
  const run = producer()
    .then((value) => {
      const ttl = typeof ttlSeconds === "function" ? ttlSeconds(value) : ttlSeconds;
      if (ttl > 0) store.set(key, value, ttl);
      return value;
    })
    .finally(() => pending.delete(key));
  pending.set(key, run);
  return run;
}

/** Whether `key` is being computed right now (by some earlier caller). */
export const isPending = (key: string): boolean => pending.has(key);

/** Drops every cached value whose key starts with one of `prefixes`. */
export function dropCached(prefixes: string[]): void {
  const keys = store.keys().filter((k) => prefixes.some((p) => k.startsWith(p)));
  if (keys.length) store.del(keys);
}
