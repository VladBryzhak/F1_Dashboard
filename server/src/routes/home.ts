import { Router } from "express";
import { getHomeHighlights } from "../services/f1db";
import { getNews } from "../services/news";
import type { HomeResponse } from "../types/f1";

const router = Router();

// GET /api/home — dynamic weekend highlights + latest news headlines. News is
// best-effort: a feed failure returns an empty list rather than failing the page.
router.get("/", async (_req, res, next) => {
  try {
    const [highlights, news] = await Promise.all([
      getHomeHighlights(),
      getNews().catch(() => []),
    ]);
    const body: HomeResponse = { highlights, news };
    res.json(body);
  } catch (err) {
    next(err);
  }
});

export default router;
