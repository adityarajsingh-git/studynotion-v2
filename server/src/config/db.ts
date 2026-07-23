import mongoose from "mongoose";
import { env } from "./env";

export async function connectDB(): Promise<boolean> {
  if (!env.mongoUrl) {
    console.warn("⚠️  MONGODB_URL not set — API routes that need the DB will fail. Add it to server/.env");
    return false;
  }
  try {
    await mongoose.connect(env.mongoUrl);
    console.log("✅ MongoDB connected");
    return true;
  } catch (err) {
    console.error("❌ MongoDB connection failed:", (err as Error).message);
    return false;
  }
}
