import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { auth, makeCategory, makeUser } from "./helpers";

const app = createApp();

describe("GET /api/v2/categories", () => {
  it("lists categories sorted by name", async () => {
    await makeCategory("Web Development");
    await makeCategory("Data & Databases");
    await makeCategory("Mobile Development");

    const res = await request(app).get("/api/v2/categories");
    expect(res.status).toBe(200);
    expect(res.body.categories.map((c: { name: string }) => c.name)).toEqual([
      "Data & Databases",
      "Mobile Development",
      "Web Development",
    ]);
  });

  it("is public", async () => {
    const res = await request(app).get("/api/v2/categories");
    expect(res.status).toBe(200);
  });
});

describe("POST /api/v2/categories", () => {
  it("lets an instructor create one", async () => {
    const instructor = await makeUser(app, { role: "instructor" });
    const res = await request(app).post("/api/v2/categories")
      .set(auth(instructor.token))
      .send({ name: "DevOps", description: "Ship it" });

    expect(res.status).toBe(201);
    expect(res.body.category.name).toBe("DevOps");
  });

  it("blocks students with 403", async () => {
    const student = await makeUser(app);
    const res = await request(app).post("/api/v2/categories")
      .set(auth(student.token)).send({ name: "DevOps" });
    expect(res.status).toBe(403);
  });

  it("requires a name", async () => {
    const instructor = await makeUser(app, { role: "instructor" });
    const res = await request(app).post("/api/v2/categories")
      .set(auth(instructor.token)).send({ description: "no name" });
    expect(res.status).toBe(400);
  });

  // Regression: the unique-index violation used to surface as a 500.
  it("returns 409 for a duplicate name", async () => {
    const instructor = await makeUser(app, { role: "instructor" });
    await makeCategory("DevOps");

    const res = await request(app).post("/api/v2/categories")
      .set(auth(instructor.token)).send({ name: "DevOps" });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already taken/i);
  });
});
