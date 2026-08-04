import { afterEach, describe, expect, it, vi } from "vitest";

// env.ts resolves the secret once at module load, so each case reloads the
// module against a stubbed environment. JWT_SECRET is stubbed to "" (defined
// but empty) rather than deleted: empty is still falsy, and a defined key
// stops dotenv from re-filling it if a local .env happens to exist.
async function loadEnv() {
  vi.resetModules();
  return import("../src/config/env");
}

describe("config/env — JWT secret handling", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // Security regression: the secret used to fall back to a public string in
  // EVERY environment. A production deploy missing JWT_SECRET silently signed
  // tokens with a secret that lives in this repo — anyone could forge a valid
  // token for any user or role. Boot must fail instead.
  it("refuses to start in production when JWT_SECRET is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "");
    await expect(loadEnv()).rejects.toThrow(/JWT_SECRET/);
  });

  // The check is an allowlist (development/test), not a production denylist —
  // otherwise NODE_ENV=staging/qa/preview would silently run on the public
  // fallback. The error names the offending env to make debugging easy.
  it("refuses to start in any non-dev/test environment (e.g. staging)", async () => {
    vi.stubEnv("NODE_ENV", "staging");
    vi.stubEnv("JWT_SECRET", "");
    await expect(loadEnv()).rejects.toThrow(/JWT_SECRET.*"staging"/);
  });

  it("boots in production when JWT_SECRET is provided", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "a-real-production-secret");
    const { env } = await loadEnv();
    expect(env.jwtSecret).toBe("a-real-production-secret");
  });

  it("falls back with a visible warning in development", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JWT_SECRET", "");
    const { env } = await loadEnv();
    expect(env.jwtSecret).toBe("dev-only-secret-change-me");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("JWT_SECRET"));
  });

  it("falls back silently under NODE_ENV=test so suites run without a .env", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("JWT_SECRET", "");
    const { env } = await loadEnv();
    expect(env.jwtSecret).toBe("dev-only-secret-change-me");
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("config/env — MongoDB URL handling", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // Deploy regression guard: without MONGODB_URL the server used to boot
  // "healthy" and then fail on every DB-backed route once traffic arrived.
  // Production must fail fast at boot instead. JWT_SECRET is stubbed valid so
  // this failure is unambiguously about the mongo URL.
  it("refuses to start in production when MONGODB_URL is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "a-real-production-secret");
    vi.stubEnv("MONGODB_URL", "");
    await expect(loadEnv()).rejects.toThrow(/MONGODB_URL/);
  });

  // Same allowlist shape as the JWT check — staging/qa/preview must not slip
  // through a production-only denylist.
  it("refuses to start in staging when MONGODB_URL is missing", async () => {
    vi.stubEnv("NODE_ENV", "staging");
    vi.stubEnv("JWT_SECRET", "a-real-production-secret");
    vi.stubEnv("MONGODB_URL", "");
    await expect(loadEnv()).rejects.toThrow(/MONGODB_URL.*"staging"/);
  });

  it("boots in production when MONGODB_URL is provided", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "a-real-production-secret");
    vi.stubEnv("MONGODB_URL", "mongodb://db.example.com/sn2");
    const { env } = await loadEnv();
    expect(env.mongoUrl).toBe("mongodb://db.example.com/sn2");
  });

  // Dev keeps today's behavior: boots without a URL (connectDB() warns at
  // connect time) so `npm run dev` works before a .env exists.
  it("boots without MONGODB_URL in development", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JWT_SECRET", "");
    vi.stubEnv("MONGODB_URL", "");
    const { env } = await loadEnv();
    expect(env.mongoUrl).toBe("");
  });

  // The suites bring their own mongodb-memory-server — no URL needed.
  it("boots without MONGODB_URL under NODE_ENV=test", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("JWT_SECRET", "");
    vi.stubEnv("MONGODB_URL", "");
    const { env } = await loadEnv();
    expect(env.mongoUrl).toBe("");
  });
});
