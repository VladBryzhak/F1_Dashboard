import { Router } from "express";
import { getDriverPhoto } from "../services/driverPhotos";
import { getRecords } from "../services/f1db";
import type { RecordEntry } from "../types/f1";

const router = Router();

// GET /api/records -> all-time records: drivers' titles, wins, poles,
// podiums, starts, fastest laps, wins in a season, youngest winners; teams'
// titles, wins, poles (top ten of each)
router.get("/", async (_req, res, next) => {
  try {
    const r = await getRecords();
    // each drivers' list's holder gets a Wikimedia photo, the fallback for
    // drivers without an official portrait (the profiles do the same)
    const withPhoto = async (rows: RecordEntry[]) =>
      rows.length ? [{ ...rows[0], photoUrl: await getDriverPhoto(rows[0].name).catch(() => null) }, ...rows.slice(1)] : rows;
    const drivers = Object.fromEntries(
      await Promise.all(Object.entries(r.drivers).map(async ([k, rows]) => [k, await withPhoto(rows)] as const)),
    ) as typeof r.drivers;
    res.set("Cache-Control", "public, max-age=3600").json({ ...r, drivers });
  } catch (err) {
    next(err);
  }
});

export default router;
