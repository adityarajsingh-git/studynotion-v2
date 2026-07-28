import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import authRoutes from "./routes/auth.routes";
import categoryRoutes from "./routes/category.routes";
import courseRoutes from "./routes/course.routes";
import { notFound, errorHandler } from "./middleware/error";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin.split(","), credentials: true }));
  // 10kb is generous for every JSON body this API accepts; anything bigger is
  // a mistake or a memory-exhaustion attempt.
  app.use(express.json({ limit: "10kb" }));

  // Brute-force guard for credential endpoints ONLY — catalog/course browsing
  // is normal traffic and must never 429. Declared per-app so each test app
  // gets its own counter store. Skipped under NODE_ENV=test: suites sign up a
  // fresh user per test from one IP and would trip the limit instantly.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test",
  });
  app.use(["/api/v2/auth/signup", "/api/v2/auth/login"], authLimiter);

  app.get("/api/v2/health", (_req, res) =>
    res.json({ success: true, service: "studynotion-v2-api", time: new Date().toISOString() })
  );
  app.use("/api/v2/auth", authRoutes);
  app.use("/api/v2/categories", categoryRoutes);
  app.use("/api/v2/courses", courseRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
