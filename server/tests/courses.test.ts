import { describe, expect, it } from "vitest";
import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../src/app";
import { auth, makeCategory, makeCourse, makeUser } from "./helpers";

const app = createApp();

async function seedCatalog() {
  const instructor = await makeUser(app, { role: "instructor" });
  const web = await makeCategory("Web Development");
  const data = await makeCategory("Data & Databases");
  const react = await makeCourse({
    instructorId: instructor.user.id, categoryId: String(web._id), title: "React from Zero", price: 499,
  });
  const mongo = await makeCourse({
    instructorId: instructor.user.id, categoryId: String(data._id), title: "MongoDB Modelling", price: 349,
  });
  return { instructor, web, data, react, mongo };
}

describe("GET /api/v2/courses", () => {
  it("lists courses with instructor and category hydrated", async () => {
    await seedCatalog();
    const res = await request(app).get("/api/v2/courses");

    expect(res.status).toBe(200);
    expect(res.body.courses).toHaveLength(2);
    expect(res.body.courses[0].instructor.name).toEqual(expect.any(String));
    expect(res.body.courses[0].category.name).toEqual(expect.any(String));
  });

  it("filters by category", async () => {
    const { web } = await seedCatalog();
    const res = await request(app).get(`/api/v2/courses?category=${web._id}`);

    expect(res.status).toBe(200);
    expect(res.body.courses).toHaveLength(1);
    expect(res.body.courses[0].title).toBe("React from Zero");
  });

  it("searches by title, case-insensitively", async () => {
    await seedCatalog();
    const res = await request(app).get("/api/v2/courses?search=mongodb");

    expect(res.status).toBe(200);
    expect(res.body.courses).toHaveLength(1);
    expect(res.body.courses[0].title).toBe("MongoDB Modelling");
  });

  it("returns an empty list rather than an error when nothing matches", async () => {
    await seedCatalog();
    const res = await request(app).get("/api/v2/courses?search=nothingmatchesthis");
    expect(res.status).toBe(200);
    expect(res.body.courses).toEqual([]);
  });

  // Regression: an unparseable category used to raise a Mongoose CastError,
  // which the error handler turned into a 500.
  it("rejects a malformed category filter with 400, not 500", async () => {
    const res = await request(app).get("/api/v2/courses?category=not-an-object-id");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid category/i);
  });
});

describe("GET /api/v2/courses/:id", () => {
  it("returns a single course", async () => {
    const { react } = await seedCatalog();
    const res = await request(app).get(`/api/v2/courses/${react._id}`);

    expect(res.status).toBe(200);
    expect(res.body.course.title).toBe("React from Zero");
    expect(res.body.course.lessons).toHaveLength(1);
  });

  // Regression: this used to be a 500 with a raw Mongoose message.
  it("returns 404 for a malformed id", async () => {
    const res = await request(app).get("/api/v2/courses/abc");
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Course not found");
  });

  it("returns 404 for a well-formed id that doesn't exist", async () => {
    const res = await request(app).get(`/api/v2/courses/${new Types.ObjectId()}`);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/v2/courses", () => {
  it("lets an instructor create a course", async () => {
    const instructor = await makeUser(app, { role: "instructor" });
    const category = await makeCategory();

    const res = await request(app).post("/api/v2/courses").set(auth(instructor.token)).send({
      title: "New Course",
      description: "Made in a test",
      category: String(category._id),
      price: 0,
      lessons: [{ title: "Intro", durationMin: 10 }],
    });

    expect(res.status).toBe(201);
    expect(res.body.course.title).toBe("New Course");
    expect(res.body.course.instructor).toBe(instructor.user.id);
  });

  it("blocks students with 403", async () => {
    const student = await makeUser(app);
    const category = await makeCategory();
    const res = await request(app).post("/api/v2/courses").set(auth(student.token))
      .send({ title: "X", description: "Y", category: String(category._id), price: 10 });

    expect(res.status).toBe(403);
  });

  it("blocks anonymous callers with 401", async () => {
    const res = await request(app).post("/api/v2/courses").send({ title: "X" });
    expect(res.status).toBe(401);
  });

  it("requires the core fields", async () => {
    const instructor = await makeUser(app, { role: "instructor" });
    const res = await request(app).post("/api/v2/courses").set(auth(instructor.token))
      .send({ title: "Only a title" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v2/courses/:id/enroll", () => {
  it("enrolls a student and reflects it on both sides of the relation", async () => {
    const { react } = await seedCatalog();
    const student = await makeUser(app);

    const res = await request(app)
      .post(`/api/v2/courses/${react._id}/enroll`)
      .set(auth(student.token));
    expect(res.status).toBe(200);

    // The user now carries the course...
    const me = await request(app).get("/api/v2/auth/me").set(auth(student.token));
    expect(me.body.user.enrolledCourses).toHaveLength(1);
    expect(me.body.user.enrolledCourses[0].title).toBe("React from Zero");

    // ...and the course carries the student.
    const course = await request(app).get(`/api/v2/courses/${react._id}`);
    expect(course.body.course.students).toContain(student.user.id);
  });

  it("rejects a second enrollment with 409", async () => {
    const { react } = await seedCatalog();
    const student = await makeUser(app);
    const url = `/api/v2/courses/${react._id}/enroll`;

    await request(app).post(url).set(auth(student.token)).expect(200);
    const second = await request(app).post(url).set(auth(student.token));
    expect(second.status).toBe(409);
    expect(second.body.message).toBe("Already enrolled");
  });

  it("requires authentication", async () => {
    const { react } = await seedCatalog();
    const res = await request(app).post(`/api/v2/courses/${react._id}/enroll`);
    expect(res.status).toBe(401);
  });

  it("returns 404 for a malformed course id", async () => {
    const student = await makeUser(app);
    const res = await request(app).post("/api/v2/courses/abc/enroll").set(auth(student.token));
    expect(res.status).toBe(404);
  });
});
