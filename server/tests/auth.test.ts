import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { auth, makeCategory, makeCourse, makeUser } from "./helpers";

const app = createApp();

describe("POST /api/v2/auth/signup", () => {
  it("creates a user and returns a token", async () => {
    const res = await request(app).post("/api/v2/auth/signup").send({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "secret123",
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ name: "Ada Lovelace", email: "ada@example.com", role: "student" });
    expect(res.body.user.password).toBeUndefined();
  });

  // Regression: the client reads user.enrolledCourses straight off this response.
  it("returns enrolledCourses as an empty array, not undefined", async () => {
    const res = await request(app).post("/api/v2/auth/signup").send({
      name: "New User", email: "new@example.com", password: "secret123",
    });
    expect(res.body.user.enrolledCourses).toEqual([]);
  });

  it("honours an instructor role but ignores anything else", async () => {
    const inst = await request(app).post("/api/v2/auth/signup")
      .send({ name: "I", email: "i@example.com", password: "secret123", role: "instructor" });
    expect(inst.body.user.role).toBe("instructor");

    const admin = await request(app).post("/api/v2/auth/signup")
      .send({ name: "A", email: "a@example.com", password: "secret123", role: "admin" });
    expect(admin.body.user.role).toBe("student");
  });

  it.each([
    ["missing fields", { email: "x@example.com" }, "required"],
    ["invalid email", { name: "X", email: "not-an-email", password: "secret123" }, "Invalid email"],
    ["short password", { name: "X", email: "x@example.com", password: "123" }, "at least 6"],
  ])("rejects %s with 400", async (_label, body, fragment) => {
    const res = await request(app).post("/api/v2/auth/signup").send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain(fragment);
  });

  it("rejects a duplicate email with 409", async () => {
    await makeUser(app, { email: "dupe@example.com" });
    const res = await request(app).post("/api/v2/auth/signup")
      .send({ name: "Other", email: "dupe@example.com", password: "secret123" });
    expect(res.status).toBe(409);
  });
});

describe("POST /api/v2/auth/login", () => {
  it("returns a token for valid credentials", async () => {
    await makeUser(app, { email: "login@example.com", password: "secret123" });
    const res = await request(app).post("/api/v2/auth/login")
      .send({ email: "login@example.com", password: "secret123" });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe("login@example.com");
  });

  // Regression for the dashboard bug: login used to omit enrolledCourses
  // entirely, so the dashboard showed "nothing yet" until a page reload.
  it("returns populated enrolledCourses so the dashboard renders immediately", async () => {
    const student = await makeUser(app, { email: "enrolled@example.com", password: "secret123" });
    const instructor = await makeUser(app, { email: "teach@example.com", role: "instructor" });
    const category = await makeCategory();
    const course = await makeCourse({
      instructorId: instructor.user.id,
      categoryId: String(category._id),
      title: "Populated Course",
      price: 799,
    });

    await request(app)
      .post(`/api/v2/courses/${course._id}/enroll`)
      .set(auth(student.token))
      .expect(200);

    const res = await request(app).post("/api/v2/auth/login")
      .send({ email: "enrolled@example.com", password: "secret123" });

    expect(res.status).toBe(200);
    expect(res.body.user.enrolledCourses).toHaveLength(1);
    expect(res.body.user.enrolledCourses[0]).toMatchObject({
      title: "Populated Course",
      price: 799,
    });
  });

  it.each([
    ["a wrong password", { email: "login@example.com", password: "wrongpass" }],
    ["an unknown email", { email: "ghost@example.com", password: "secret123" }],
  ])("rejects %s with 401 and a generic message", async (_label, body) => {
    await makeUser(app, { email: "login@example.com", password: "secret123" });
    const res = await request(app).post("/api/v2/auth/login").send(body);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid credentials");
  });

  it("requires both fields", async () => {
    const res = await request(app).post("/api/v2/auth/login").send({ email: "x@example.com" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/v2/auth/me", () => {
  it("returns the current user", async () => {
    const { token, user } = await makeUser(app, { name: "Grace Hopper" });
    const res = await request(app).get("/api/v2/auth/me").set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: user.id, name: "Grace Hopper", enrolledCourses: [] });
  });

  it.each([
    ["no token", undefined],
    ["a malformed header", "Token abc"],
    ["a garbage token", "Bearer not.a.jwt"],
  ])("rejects %s with 401", async (_label, header) => {
    const req = request(app).get("/api/v2/auth/me");
    if (header) req.set("Authorization", header);
    const res = await req;
    expect(res.status).toBe(401);
  });

  it("returns the same user shape as login", async () => {
    const { token, user: fromSignup } = await makeUser(app, { email: "shape@example.com" });
    const fromMe = (await request(app).get("/api/v2/auth/me").set(auth(token))).body.user;
    expect(Object.keys(fromMe).sort()).toEqual(Object.keys(fromSignup).sort());
  });
});
