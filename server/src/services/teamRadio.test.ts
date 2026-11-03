import { describe, expect, it } from "vitest";
import { sessionRadio } from "./teamRadio";

describe("sessionRadio", () => {
  it("serves a session's reviewed clips in order, unclear parts marked", () => {
    const r = sessionRadio(11404);
    expect(r.clips.length).toBeGreaterThan(0);
    const dates = r.clips.map((c) => c.date);
    expect([...dates].sort()).toEqual(dates);
    for (const c of r.clips) {
      expect(c.url).toMatch(/^https:\/\/livetiming\.formula1\.com\//);
      for (const l of c.lines) expect(l.en == null).toBe(l.uk == null);
    }
    const champ = r.clips.find((c) => c.id === "ANT_12_20261101_162613")!;
    expect(champ.unclear).toBe(false);
    expect(champ.lines[0]).toMatchObject({ who: "driver", en: expect.stringContaining("We did it") });
    expect(r.clips.find((c) => c.id === "LEC_16_20261101_160947")?.unclear).toBe(true);
  });

  it("answers an empty list for a session without radio", () => {
    expect(sessionRadio(1)).toEqual({ sessionKey: 1, clips: [] });
  });
});
