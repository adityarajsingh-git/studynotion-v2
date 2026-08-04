import dotenv from "dotenv";
dotenv.config();

const nodeEnv = process.env.NODE_ENV || "development";

/**
 * Resolve the JWT signing secret.
 *
 * The old code fell back to a PUBLIC string ("dev-only-secret-change-me") in
 * every environment. A deploy that forgot JWT_SECRET would silently sign
 * tokens with a secret anyone can read in this repo — letting attackers forge
 * a valid token for any user or role. The fallback is now allowlisted to
 * development and test ONLY — every other environment (production, staging,
 * qa, preview, ...) refuses to boot. Dev keeps the fallback with a loud
 * warning and test keeps it silently, so `npm run dev` and the suites still
 * work without a .env.
 */
function resolveJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv) return fromEnv;

  if (nodeEnv !== "development" && nodeEnv !== "test") {
    throw new Error(
      `JWT_SECRET is not set. Refusing to start with NODE_ENV="${nodeEnv}" on the public dev fallback — anyone could forge auth tokens. Set JWT_SECRET (see server/.env.example).`
    );
  }

  if (nodeEnv !== "test") {
    console.warn(
      "⚠️  JWT_SECRET not set — using an insecure dev-only fallback. Auth tokens are forgeable. Set JWT_SECRET in server/.env before deploying."
    );
  }

  return "dev-only-secret-change-me";
}

/**
 * Resolve the MongoDB connection string.
 *
 * Same allowlist shape as the JWT secret above: a deploy that forgets
 * MONGODB_URL used to boot "healthy" and then fail on every DB-backed route —
 * a silent failure that only surfaces when traffic hits. Outside development
 * and test the server now refuses to boot instead. Dev keeps the current
 * behavior (connectDB() warns loudly at connect time) so `npm run dev` works
 * before a .env exists, and the test suite brings its own in-memory MongoDB.
 */
function resolveMongoUrl(): string {
  const fromEnv = process.env.MONGODB_URL;
  if (fromEnv) return fromEnv;

  if (nodeEnv !== "development" && nodeEnv !== "test") {
    throw new Error(
      `MONGODB_URL is not set. Refusing to start with NODE_ENV="${nodeEnv}" — the API would boot but every DB-backed route would fail. Set MONGODB_URL (see server/.env.example).`
    );
  }

  return "";
}

export const env = {
  port: Number(process.env.PORT) || 4000,
  mongoUrl: resolveMongoUrl(),
  jwtSecret: resolveJwtSecret(),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
};
