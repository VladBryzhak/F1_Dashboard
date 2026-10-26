import compression from "compression";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import fs from "fs";
import helmet from "helmet";
import path from "path";
import calendarRouter from "./routes/calendar";
import circuitsRouter from "./routes/circuits";
import feedbackRouter from "./routes/feedback";
import homeRouter from "./routes/home";
import liveRouter from "./routes/live";
import profilesRouter from "./routes/profiles";
import standingsRouter from "./routes/standings";
import telemetryRouter from "./routes/telemetry";
import { previewPng } from "./services/og";
import { pageHtml } from "./services/pageHtml";
import { sitemapXml } from "./services/sitemap";

const app = express();
const PORT = process.env.PORT ?? 3001;

// Security headers. HSTS + clickjacking/MIME/referrer protection are on; the
// Content-Security-Policy is left off here and added as a separate, tailored
// step (it must allow our external sources: formula1.com images,
// flagcdn, OpenF1). CORP is cross-origin because the API is consumed by other
// origins (the mobile app on capacitor://localhost).
// gzip/deflate text responses (HTML, JS, CSS, JSON) so they aren't sent
// uncompressed over the wire — cuts transfer size and document latency.
app.use(compression());
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/home", homeRouter);
app.use("/api/feedback", feedbackRouter);
app.use("/api/live", liveRouter);
app.use("/api/standings", standingsRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/circuits", circuitsRouter);
app.use("/api/telemetry", telemetryRouter);
// Owns two top-level paths directly: /api/drivers/:id and /api/constructors/:id
app.use("/api", profilesRouter);

// In production we serve the built React client from the same server, so the
// whole app runs as one service (one origin, no CORS, no separate frontend
// host). The client build lives at <repo>/client/dist.
const clientDist = path.resolve(__dirname, "../../client/dist");
// Sitemap built from the dataset (services/sitemap.ts), ahead of the static
// files so it is never shadowed by an old build's sitemap.xml.
app.get("/sitemap.xml", async (_req, res, next) => {
  try {
    res.set("Cache-Control", "public, max-age=3600");
    res.type("application/xml").send(await sitemapXml());
  } catch (err) {
    next(err);
  }
});

// Link-preview images: /og/<page path>.png (e.g. /og/drivers/max-verstappen.png).
app.get(/^\/og\/(.+)\.png$/, async (req, res, next) => {
  try {
    const page = "/" + req.params[0];
    const png = await previewPng(page === "/index" ? "/" : page);
    res.set("Cache-Control", "public, max-age=86400");
    res.type("png").send(png);
  } catch (err) {
    next(err);
  }
});

if (fs.existsSync(clientDist)) {
  // index: false — pages (including "/") go through the fallback below, which
  // fills in each page's meta tags.
  app.use(
    express.static(clientDist, {
      index: false,
      // Vite's /assets files have content hashes in their names, so they can
      // be cached for good; self-hosted fonts rarely change.
      setHeaders(res, filePath) {
        const rel = path.relative(clientDist, filePath).split(path.sep)[0];
        if (rel === "assets") res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        else if (rel === "fonts") res.setHeader("Cache-Control", "public, max-age=2592000");
      },
    })
  );
  // Agent-discovery manifest. express.static serves /ai-catalog.json from the
  // build, but ignores dotfolders, so serve the well-known path explicitly
  // (both return the same file) instead of letting it fall to the SPA shell.
  app.get(
    ["/.well-known/ai-catalog.json", "/ai-catalog.json"],
    (_req, res) => {
      res.type("application/json");
      res.sendFile(path.join(clientDist, "ai-catalog.json"));
    }
  );
  // SPA fallback: any non-API route returns index.html so client-side routing
  // (react-router) works on deep links / refreshes.
  app.get("*", async (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    try {
      // Crawlers get a text snapshot in the page (pageHtml), people don't.
      res
        .vary("User-Agent")
        .type("html")
        .send(await pageHtml(path.join(clientDist, "index.html"), req.path, req.get("user-agent")));
    } catch (err) {
      next(err);
    }
  });
}

// Centralized error handler.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Unknown error";
  console.error("[error]", message);
  res.status(502).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`F1 Dashboard API listening on http://localhost:${PORT}`);
});
