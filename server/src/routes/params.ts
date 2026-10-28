// Route parameter checks. Parameters that reach OpenF1 or become cache keys
// must be plain numbers in a sane range: otherwise any string would be sent
// upstream and cached under its own key, letting one client make the server
// hammer OpenF1 and fill its memory.

// A whole number within [min, max], or null.
export function intParam(value: string | undefined, min: number, max: number): number | null {
  if (!value || !/^\d{1,7}$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

// OpenF1 has data from 2023; allow up to next season for early calendars.
export const OPENF1_FIRST_SEASON = 2023;
export const lastSeasonAllowed = () => new Date().getUTCFullYear() + 1;

export const SESSION_KEY_MAX = 999_999;
export const DRIVER_NUMBER_MAX = 99;
export const LAP_MAX = 200;
