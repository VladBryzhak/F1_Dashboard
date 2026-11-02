import { Router } from "express";
import { getArticle, listArticles } from "../services/articles";
import type { Lang } from "../services/gpNames";

const router = Router();

const langOf = (q: unknown): Lang => (q === "uk" ? "uk" : "en");

// GET /api/articles?lang=uk — every article, newest first, in that language.
router.get("/", async (req, res, next) => {
  try {
    res.json(await listArticles(langOf(req.query.lang)));
  } catch (err) {
    next(err);
  }
});

// GET /api/articles/:slug?lang=uk — one article with its body and three more.
router.get("/:slug", async (req, res, next) => {
  try {
    const article = await getArticle(req.params.slug, langOf(req.query.lang));
    if (!article) return res.status(404).json({ error: "Not found" });
    res.json(article);
  } catch (err) {
    next(err);
  }
});

export default router;
