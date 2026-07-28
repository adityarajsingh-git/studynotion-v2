import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";

const app = createApp();

describe("security hardening", () => {
  // The active-limiter test below stubs NODE_ENV; never let that leak into
  // other tests, which rely on NODE_ENV=test to skip the limiter.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Guards the helmet() wiring: if someone drops the middleware, browsers
  // lose MIME-sniffing and clickjacking protection on every response. We
  // spot-check two headers helmet always sets instead of pinning its full,
  // version-dependent header set.
  it("sets security headers on responses", async () => {
    const res = await request(app).get("/api/v2/health");
    expect(res.status).toBe(200);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });

  // Guards the 10kb JSON body cap (memory-exhaustion protection) AND that the
  // resulting 413 is rendered by our JSON error handler — not express's HTML
  // default, and not the generic 500 it previously fell through to. API
  // clients parse every error body as JSON.
  it("rejects a JSON body over 10kb with a clean 413 JSON response", async () => {
    const res = await request(app)
      .post("/api/v2/auth/signup")
      .send({
        name: "x".repeat(11_000), // ~11kb body, just over the limit
        email: "big@example.com",
        password: "secret123",
      });
    expect(res.status).toBe(413);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({ success: false, message: "Request body too large" });
  });

  // Guards the limiter's NODE_ENV=test skip. The auth limit is 20 requests
  // per 15 min per IP, and the suites sign up a fresh user per test from one
  // IP (makeUser) — without the skip, every suite after the twentieth signup
  // would start failing with 429s. 25 back-to-back login attempts must never
  // be rate limited here.
  it("skips the auth rate limiter under NODE_ENV=test", async () => {
    for (let i = 0; i < 25; i++) {
      const res = await request(app)
        .post("/api/v2/auth/login")
        .send({ email: "nobody@example.com", password: "wrong-password" });
      expect(res.status).not.toBe(429);
    }
  });

  // Guards the limiter's actual 429 behavior. The test above only proves the
  // NODE_ENV=test skip works — if the limit were bumped to 20000 or the
  // app.use([...], authLimiter) line were deleted, every suite would still
  // pass. This test proves the limiter limits: both are needed. skip() reads
  // process.env.NODE_ENV per-request, so stubbing it to "development" arms the
  // limiter; a fresh createApp() gets its own counter store, so the 20-request
  // budget here can't leak into (or from) any other test.
  it("rate limits the 21st auth request when the limiter is active", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const limitedApp = createApp();

    // The full budget goes through untouched…
    for (let i = 0; i < 20; i++) {
      const res = await request(limitedApp)
        .post("/api/v2/auth/login")
        .send({ email: "nobody@example.com", password: "wrong-password" });
      expect(res.status).not.toBe(429);
    }

    // …and the 21st request from the same IP is rejected.
    const res = await request(limitedApp)
      .post("/api/v2/auth/login")
      .send({ email: "nobody@example.com", password: "wrong-password" });
    expect(res.status).toBe(429);
  });
});
