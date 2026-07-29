import { describe, expect, it } from "vitest";
import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../src/app";
import { auth, makeCategory, makeCourse, makeUser } from "./helpers";

const app = createApp();

/** Seeds an instructor-owned course with three lessons; returns the string ids. */
async function seedWithLessons(status: "draft" | "published" = "published") {
  const owner = await makeUser(app, { role: "instructor" });
  const category = await makeCategory("Web Development");
  const course = await makeCourse({
    instructorId: owner.user.id,
    categoryId: String(category._id),
    title: "React from Zero",
    status,
    lessons: [
      { title: "Intro", durationMin: 5 },
      { title: "JSX", durationMin: 20 },
      { title: "Hooks", durationMin: 40 },
    ],
  });
  const ids = course.lessons.map((l) => String(l._id));
  return { owner, category, course, ids };
}

/**
 * Reads the lessons back through GET /courses/:id (as the owner, so drafts
 * resolve too) — assertions below check PERSISTED state, not just whatever
 * the mutating response happened to echo.
 */
async function fetchLessons(courseId: unknown, token: string) {
  const res = await request(app).get(`/api/v2/courses/${courseId}`).set(auth(token));
  return res.body.course.lessons as { _id: string; title: string; durationMin: number }[];
}

describe("POST /api/v2/courses/:id/lessons", () => {
  // Happy path: the lesson lands at the END of the list and the response
  // carries the Mongoose-assigned _id the client needs to target it later.
  it("lets the owner add a lesson and returns its _id", async () => {
    const { owner, course } = await seedWithLessons();
    const res = await request(app)
      .post(`/api/v2/courses/${course._id}/lessons`)
      .set(auth(owner.token))
      .send({ title: "Deploy", durationMin: 15 });

    expect(res.status).toBe(201);
    expect(res.body.lesson._id).toEqual(expect.any(String));
    expect(res.body.lesson.title).toBe("Deploy");

    const lessons = await fetchLessons(course._id, owner.token);
    expect(lessons).toHaveLength(4);
    expect(lessons[3].title).toBe("Deploy");
  });

  // durationMin is optional on create — it defaults to 0, not undefined.
  it("defaults durationMin to 0 when omitted", async () => {
    const { owner, course } = await seedWithLessons();
    const res = await request(app)
      .post(`/api/v2/courses/${course._id}/lessons`)
      .set(auth(owner.token))
      .send({ title: "Outro" });

    expect(res.status).toBe(201);
    expect(res.body.lesson.durationMin).toBe(0);
  });

  // A whitespace-only title is empty after trim — required means non-empty.
  it("returns 400 for an empty title", async () => {
    const { owner, course } = await seedWithLessons();
    const res = await request(app)
      .post(`/api/v2/courses/${course._id}/lessons`)
      .set(auth(owner.token))
      .send({ title: "   " });

    expect(res.status).toBe(400);
  });

  // durationMin must be a non-negative integer — negatives are a client error.
  it("returns 400 for a negative durationMin", async () => {
    const { owner, course } = await seedWithLessons();
    const res = await request(app)
      .post(`/api/v2/courses/${course._id}/lessons`)
      .set(auth(owner.token))
      .send({ title: "Bad", durationMin: -5 });

    expect(res.status).toBe(400);
  });

  // Role gate: students can never touch course content.
  it("returns 403 for a student", async () => {
    const { course } = await seedWithLessons();
    const student = await makeUser(app);
    const res = await request(app)
      .post(`/api/v2/courses/${course._id}/lessons`)
      .set(auth(student.token))
      .send({ title: "Nope" });

    expect(res.status).toBe(403);
  });

  // Auth gate: no token, no write.
  it("returns 401 for an anonymous caller", async () => {
    const { course } = await seedWithLessons();
    const res = await request(app)
      .post(`/api/v2/courses/${course._id}/lessons`)
      .send({ title: "Nope" });

    expect(res.status).toBe(401);
  });

  // Ownership: a published course is public, so the honest denial is 403.
  it("returns 403 for another instructor on a published course", async () => {
    const { course } = await seedWithLessons("published");
    const rival = await makeUser(app, { role: "instructor" });
    const res = await request(app)
      .post(`/api/v2/courses/${course._id}/lessons`)
      .set(auth(rival.token))
      .send({ title: "Hijack" });

    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/v2/courses/:id/lessons/:lessonId", () => {
  // Happy path: both editable fields change and persist.
  it("lets the owner edit title and durationMin", async () => {
    const { owner, course, ids } = await seedWithLessons();
    const res = await request(app)
      .patch(`/api/v2/courses/${course._id}/lessons/${ids[1]}`)
      .set(auth(owner.token))
      .send({ title: "JSX in Depth", durationMin: 25 });

    expect(res.status).toBe(200);

    const lessons = await fetchLessons(course._id, owner.token);
    expect(lessons[1].title).toBe("JSX in Depth");
    expect(lessons[1].durationMin).toBe(25);
  });

  // A lessonId that matches nothing (valid ObjectId or garbage string) is 404.
  it("returns 404 for a nonexistent lessonId", async () => {
    const { owner, course } = await seedWithLessons();
    const res = await request(app)
      .patch(`/api/v2/courses/${course._id}/lessons/${new Types.ObjectId()}`)
      .set(auth(owner.token))
      .send({ title: "Ghost" });

    expect(res.status).toBe(404);
  });

  // Ownership: a draft is invisible to everyone but the owner — same 404 as
  // a nonexistent id, never a 403 that would confirm the course exists.
  it("returns 404 for another instructor on a draft", async () => {
    const { course, ids } = await seedWithLessons("draft");
    const rival = await makeUser(app, { role: "instructor" });
    const res = await request(app)
      .patch(`/api/v2/courses/${course._id}/lessons/${ids[0]}`)
      .set(auth(rival.token))
      .send({ title: "Hijack" });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/v2/courses/:id/lessons/:lessonId", () => {
  // Happy path: exactly the targeted lesson goes, the rest survive in order.
  it("lets the owner delete a lesson while the rest survive", async () => {
    const { owner, course, ids } = await seedWithLessons();
    const res = await request(app)
      .delete(`/api/v2/courses/${course._id}/lessons/${ids[1]}`)
      .set(auth(owner.token));

    expect(res.status).toBe(200);

    const lessons = await fetchLessons(course._id, owner.token);
    expect(lessons.map((l) => l.title)).toEqual(["Intro", "Hooks"]);
  });

  // 404 for a lesson that was never there.
  it("returns 404 for a nonexistent lessonId", async () => {
    const { owner, course } = await seedWithLessons();
    const res = await request(app)
      .delete(`/api/v2/courses/${course._id}/lessons/${new Types.ObjectId()}`)
      .set(auth(owner.token));

    expect(res.status).toBe(404);
  });

  // Ownership on the destructive endpoint: published → honest 403.
  it("returns 403 for another instructor on a published course", async () => {
    const { course, ids } = await seedWithLessons("published");
    const rival = await makeUser(app, { role: "instructor" });
    const res = await request(app)
      .delete(`/api/v2/courses/${course._id}/lessons/${ids[0]}`)
      .set(auth(rival.token));

    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/v2/courses/:id/lessons/reorder", () => {
  // Happy path — this also proves the route is registered BEFORE
  // /lessons/:lessonId: if "reorder" were captured as a lessonId this would
  // come back 404, not 200.
  it("reorders lessons and the new order persists", async () => {
    const { owner, course, ids } = await seedWithLessons();
    const res = await request(app)
      .patch(`/api/v2/courses/${course._id}/lessons/reorder`)
      .set(auth(owner.token))
      .send({ order: [ids[2], ids[0], ids[1]] });

    expect(res.status).toBe(200);

    const lessons = await fetchLessons(course._id, owner.token);
    expect(lessons.map((l) => l.title)).toEqual(["Hooks", "Intro", "JSX"]);
    // Same subdocuments, new positions — ids survive the reorder.
    expect(lessons.map((l) => l._id)).toEqual([ids[2], ids[0], ids[1]]);
  });

  // A short list would silently DROP the missing lesson — 400, nothing moves.
  it("returns 400 when an id is missing and leaves lessons unchanged", async () => {
    const { owner, course, ids } = await seedWithLessons();
    const res = await request(app)
      .patch(`/api/v2/courses/${course._id}/lessons/reorder`)
      .set(auth(owner.token))
      .send({ order: [ids[0], ids[1]] });

    expect(res.status).toBe(400);

    const lessons = await fetchLessons(course._id, owner.token);
    expect(lessons.map((l) => l.title)).toEqual(["Intro", "JSX", "Hooks"]);
  });

  // Duplicates keep the length check honest but would clone a lesson — 400.
  it("returns 400 for duplicate ids and leaves lessons unchanged", async () => {
    const { owner, course, ids } = await seedWithLessons();
    const res = await request(app)
      .patch(`/api/v2/courses/${course._id}/lessons/reorder`)
      .set(auth(owner.token))
      .send({ order: [ids[0], ids[0], ids[1]] });

    expect(res.status).toBe(400);

    const lessons = await fetchLessons(course._id, owner.token);
    expect(lessons.map((l) => l.title)).toEqual(["Intro", "JSX", "Hooks"]);
  });

  // An id from some other course (or thin air) is not part of the permutation.
  it("returns 400 for an unknown id and leaves lessons unchanged", async () => {
    const { owner, course, ids } = await seedWithLessons();
    const res = await request(app)
      .patch(`/api/v2/courses/${course._id}/lessons/reorder`)
      .set(auth(owner.token))
      .send({ order: [ids[0], ids[1], String(new Types.ObjectId())] });

    expect(res.status).toBe(400);

    const lessons = await fetchLessons(course._id, owner.token);
    expect(lessons.map((l) => l.title)).toEqual(["Intro", "JSX", "Hooks"]);
  });

  // Ownership: rival on a draft gets the nonexistent-course 404.
  it("returns 404 for another instructor on a draft", async () => {
    const { course, ids } = await seedWithLessons("draft");
    const rival = await makeUser(app, { role: "instructor" });
    const res = await request(app)
      .patch(`/api/v2/courses/${course._id}/lessons/reorder`)
      .set(auth(rival.token))
      .send({ order: [ids[2], ids[1], ids[0]] });

    expect(res.status).toBe(404);
  });
});
