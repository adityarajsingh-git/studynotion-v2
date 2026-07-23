import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { connectDB } from "./config/db";
import authRoutes from "./routes/auth.routes";
import categoryRoutes from "./routes/category.routes";
import courseRoutes from "./routes/course.routes";
import { notFound, errorHandler } from "./middleware/error";

const app = express();

app.use(cors({ origin: env.corsOrigin.split(","), credentials: true }));
app.use(express.json());

app.get("/api/v2/health", (_req, res) =>
  res.json({ success: true, service: "studynotion-v2-api", time: new Date().toISOString() })
);
app.use("/api/v2/auth", authRoutes);
app.use("/api/v2/categories", categoryRoutes);
app.use("/api/v2/courses", courseRoutes);

app.use(notFound);
app.use(errorHandler);

async function main() {
  await connectDB();
  app.listen(env.port, () => console.log(`🚀 StudyNotion v2 API on http://localhost:${env.port}`));
}
main();
