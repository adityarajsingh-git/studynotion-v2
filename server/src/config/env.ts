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

export const env = {
  port: Number(process.env.PORT) || 4000,
  mongoUrl: process.env.MONGODB_URL || "",
  jwtSecret: resolveJwtSecret(),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
};
