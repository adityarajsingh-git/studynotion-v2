import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createApp } from "../src/app";
import { errorHandler, notFound } from "../src/middleware/error";

const app = createApp();

/** Mounts a route that throws whatever we hand it, behind the real error handler. */
function appThatThrows(err: unknown) {
  const a = express();
  a.get("/boom", (_req, _res, next) => next(err));
  a.use(notFound);
  a.use(errorHandler);
  return a;
}

describe("routing", () => {
  it("404s an unknown route with a JSON body", async () => {
    const res = await request(app).get("/api/v2/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: "Route not found" });
  });

  it("serves the health check", async () => {
    const res = await request(app).get("/api/v2/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, service: "studynotion-v2-api" });
  });
});

describe("errorHandler", () => {
  it("maps a ValidationError to 400 and keeps the message", async () => {
    const err = Object.assign(new Error("Path `title` is required."), { name: "ValidationError" });
    const res = await request(appThatThrows(err)).get("/boom");

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("title");
  });

  it("maps a CastError to 400", async () => {
    const err = Object.assign(new Error('Cast to ObjectId failed for value "abc"'), { name: "CastError" });
    const res = await request(appThatThrows(err)).get("/boom");

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Malformed id or query parameter");
  });

  it("maps a duplicate-key error to 409 naming the field", async () => {
    const err = Object.assign(new Error("E11000 duplicate key"), {
      name: "MongoServerError",
      code: 11000,
      keyValue: { email: "taken@example.com" },
    });
    const res = await request(appThatThrows(err)).get("/boom");

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("That email is already taken");
  });

  // Regression: the handler used to echo err.message on 500s, which leaks
  // connection strings and internal paths out of Mongo errors.
  it("returns a generic 500 without leaking internals", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("connect ECONNREFUSED mongodb://user:hunter2@10.0.0.5:27017");

    const res = await request(appThatThrows(err)).get("/boom");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, message: "Server error" });
    expect(res.text).not.toContain("hunter2");
    // ...but it is still logged for the operator.
    expect(spy).toHaveBeenCalledWith(err);
    spy.mockRestore();
  });
});
