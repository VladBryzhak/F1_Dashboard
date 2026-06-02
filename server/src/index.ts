import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
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

// Centralized error handler.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Unknown error";
  console.error("[error]", message);
  res.status(502).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`F1 Dashboard API listening on http://localhost:${PORT}`);
});
