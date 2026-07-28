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
