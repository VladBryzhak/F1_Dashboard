import { describe, expect, it, vi } from "vitest";
import { cached, dropCached, isPending } from "./cache";

describe("cached", () => {
  it("runs the producer once and serves the cached value after", async () => {
    const producer = vi.fn(async () => 42);
    expect(await cached("t:once", 60, producer)).toBe(42);
    expect(await cached("t:once", 60, producer)).toBe(42);
    expect(producer).toHaveBeenCalledTimes(1);
  });

  it("shares one producer run between concurrent callers of a cold key", async () => {
    let release!: (v: string) => void;
    const producer = vi.fn(() => new Promise<string>((r) => (release = r)));
    const a = cached("t:shared", 60, producer);
    const b = cached("t:shared", 60, producer);
    expect(isPending("t:shared")).toBe(true);
    release("done");
    expect(await Promise.all([a, b])).toEqual(["done", "done"]);
    expect(producer).toHaveBeenCalledTimes(1);
    expect(isPending("t:shared")).toBe(false);
  });

  it("caches nothing when the producer fails, so the next call tries again", async () => {
    const producer = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("upstream down"))
      .mockResolvedValueOnce("ok");
    await expect(cached("t:fail", 60, producer)).rejects.toThrow("upstream down");
    expect(await cached("t:fail", 60, producer)).toBe("ok");
    expect(producer).toHaveBeenCalledTimes(2);
  });

  it("takes the TTL from the value, and a TTL of 0 keeps nothing", async () => {
    const producer = vi.fn(async () => ({ partial: true }));
    await cached("t:ttl", (v) => (v.partial ? 0 : 60), producer);
    await cached("t:ttl", (v) => (v.partial ? 0 : 60), producer);
    expect(producer).toHaveBeenCalledTimes(2);
  });

  it("drops keys by prefix", async () => {
    const producer = vi.fn(async () => 1);
    await cached("story:2026:1", 60, producer);
    await cached("other:1", 60, producer);
    dropCached(["story:"]);
    await cached("story:2026:1", 60, producer);
    await cached("other:1", 60, producer);
    expect(producer).toHaveBeenCalledTimes(3);
  });
});
