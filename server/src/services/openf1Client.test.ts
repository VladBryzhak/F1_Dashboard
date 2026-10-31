import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The queue keeps its state (what was sent in the last minute) in the
// module, so each test loads a fresh copy.
type Client = typeof import("./openf1Client");
let client: Client;
let fetchMock: ReturnType<typeof vi.fn>;

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-31T12:00:00Z"));
  vi.resetModules();
  fetchMock = vi.fn(async () => ok([]));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  client = await import("./openf1Client");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("openF1 queue", () => {
  it("sends at most 3 requests a second", async () => {
    const times: number[] = [];
    fetchMock.mockImplementation(async () => {
      times.push(Date.now());
      return ok([]);
    });
    const all = Promise.all(Array.from({ length: 6 }, (_, i) => client.openF1(`/laps?i=${i}`)));
    await vi.advanceTimersByTimeAsync(3000);
    await all;
    expect(times).toHaveLength(6);
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(334);
  });

  it("keeps a minute within 28 requests (the free tier allows 30)", async () => {
    const times: number[] = [];
    fetchMock.mockImplementation(async () => {
      times.push(Date.now());
      return ok([]);
    });
    // 30 requests fit the 90 s a visitor may wait.
    const all = Promise.all(Array.from({ length: 30 }, (_, i) => client.openF1(`/laps?n=${i}`)));
    await vi.advanceTimersByTimeAsync(90_000);
    await all;
    const start = times[0];
    expect(times.filter((t) => t < start + 60_000)).toHaveLength(28);
  });

  it("shares one call between identical requests in flight", async () => {
    const [a, b] = [client.openF1("/drivers?session_key=1"), client.openF1("/drivers?session_key=1")];
    await vi.advanceTimersByTimeAsync(10);
    await Promise.all([a, b]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reads OpenF1's 404 (no results) as an empty list", async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"detail":"No results found."}', { status: 404 }));
    const p = client.openF1("/intervals?session_key=1");
    await vi.advanceTimersByTimeAsync(10);
    expect(await p).toEqual([]);
  });

  it("turns a 401 into OpenF1Locked (a live session closes free access)", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 401 }));
    const p = client.openF1("/sessions?year=2026");
    const check = expect(p).rejects.toBeInstanceOf(client.OpenF1Locked);
    await vi.advanceTimersByTimeAsync(10);
    await check;
  });

  it("pauses on a 429, honouring Retry-After, and retries", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "Retry-After": "2" } }))
      .mockResolvedValueOnce(ok([{ lap_number: 1 }]));
    const p = client.openF1("/laps?session_key=1");
    await vi.advanceTimersByTimeAsync(10);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1500);
    expect(fetchMock).toHaveBeenCalledTimes(1); // still paused
    await vi.advanceTimersByTimeAsync(600);
    expect(await p).toEqual([{ lap_number: 1 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refuses a crawler's request at once when it would wait over 10 s", async () => {
    // Fill the queue: 40 requests are well over a minute's budget.
    for (let i = 0; i < 40; i++) client.openF1(`/fill?i=${i}`).catch(() => {});
    let refused: unknown;
    client.runAs(true, () => {
      client.openF1("/laps?session_key=9").catch((e) => (refused = e));
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(refused).toBeInstanceOf(client.OpenF1Busy);
    expect((refused as InstanceType<Client["OpenF1Busy"]>).retryAfter).toBeGreaterThan(10);
  });

  it("lets a visitor's request go before background warming", async () => {
    const order: string[] = [];
    fetchMock.mockImplementation(async (url: string) => {
      order.push(String(url).replace("https://api.openf1.org/v1", ""));
      return ok([]);
    });
    const bg = client.inBackground(() =>
      Promise.all([client.openF1("/bg?1"), client.openF1("/bg?2"), client.openF1("/bg?3")]),
    );
    await vi.advanceTimersByTimeAsync(10); // the first background request leaves
    const visitor = client.openF1("/visitor");
    await vi.advanceTimersByTimeAsync(400);
    expect(order.slice(0, 2)).toEqual(["/bg?1", "/visitor"]);
    await vi.advanceTimersByTimeAsync(20_000);
    await Promise.all([bg, visitor]);
  });

  it("optional() falls back on other errors but lets busy and locked through", async () => {
    expect(client.optional([])(new Error("timeout"))).toEqual([]);
    expect(() => client.optional([])(new client.OpenF1Busy(5))).toThrow(client.OpenF1Busy);
    expect(() => client.optional([])(new client.OpenF1Locked())).toThrow(client.OpenF1Locked);
  });
});
