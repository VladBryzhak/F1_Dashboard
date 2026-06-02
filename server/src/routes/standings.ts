import { Router } from "express";
import {
  getConstructorStandings,
  getDriverStandings,
} from "../services/jolpica";

const router = Router();

// GET /api/standings/drivers/:season
router.get("/drivers/:season", async (req, res, next) => {
  try {
    res.json(await getDriverStandings(req.params.season));
  } catch (err) {
    next(err);
  }
});

// GET /api/standings/constructors/:season
router.get("/constructors/:season", async (req, res, next) => {
  try {
    res.json(await getConstructorStandings(req.params.season));
  } catch (err) {
    next(err);
  }
});

export default router;
