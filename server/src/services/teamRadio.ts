import fs from "fs";
import path from "path";
import type { TeamRadio, TeamRadioClip } from "../types/f1";

// Team radio captions for a session's replay: the clips the broadcast aired,
// transcribed and translated on the owner's Mac (tools/team-radio) and
// committed as server/src/data/team-radio/<session_key>.json. The audio
// itself stays on F1's server (livetiming.formula1.com); a clip nobody could
// make out has no lines and `unclear` set.

const DIR = path.resolve(__dirname, "../../src/data/team-radio");
const cache = new Map<number, TeamRadio>();

interface StoredLine {
  who: "driver" | "engineer" | null;
  en?: string;
  uk?: string;
  unclear?: boolean;
}

interface StoredClip extends Omit<TeamRadioClip, "lines"> {
  lines?: StoredLine[];
}

export function sessionRadio(sessionKey: number): TeamRadio {
  const hit = cache.get(sessionKey);
  if (hit) return hit;
  let clips: StoredClip[] = [];
  try {
    clips = JSON.parse(fs.readFileSync(path.join(DIR, `${sessionKey}.json`), "utf8")).clips ?? [];
  } catch {
    // No radio for this session (yet).
  }
  const radio: TeamRadio = {
    sessionKey,
    clips: clips
      .filter((c) => /^https:\/\/livetiming\.formula1\.com\//.test(c.url))
      .map((c) => ({
        id: c.id,
        driverNumber: c.driverNumber,
        code: c.code,
        date: c.date,
        url: c.url,
        unclear: !!c.unclear || !c.lines?.some((l) => l.en),
        lines: (c.lines ?? []).map((l) =>
          l.en && !l.unclear ? { who: l.who, en: l.en, uk: l.uk ?? l.en } : { who: l.who, en: null, uk: null },
        ),
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
  cache.set(sessionKey, radio);
  return radio;
}
