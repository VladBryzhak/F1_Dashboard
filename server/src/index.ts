import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import fs from "fs";
import path from "path";
import calendarRouter from "./routes/calendar";
import standingsRouter from "./routes/standings";
import telemetryRouter from "./routes/telemetry";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/standings", standingsRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/telemetry", telemetryRouter);

// In production we serve the built React client from the same server, so the
// whole app runs as one service (one origin, no CORS, no separate frontend
// host). The client build lives at <repo>/client/dist.
const clientDist = path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback: any non-API route returns index.html so client-side routing
  // (react-router) works on deep links / refreshes.
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
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
