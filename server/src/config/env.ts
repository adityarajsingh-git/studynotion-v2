import dotenv from "dotenv";
dotenv.config();

export const env = {
  port: Number(process.env.PORT) || 4000,
  mongoUrl: process.env.MONGODB_URL || "",
  jwtSecret: process.env.JWT_SECRET || "dev-only-secret-change-me",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
};
