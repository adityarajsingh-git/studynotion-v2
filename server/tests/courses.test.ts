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

  // Security: the search term is matched as a literal string, not compiled as a
  // regex. A catastrophic-backtracking pattern (ReDoS) must return promptly
  // instead of pinning the event loop.
  it("treats a ReDoS search pattern as a literal and responds promptly", async () => {
    await seedCatalog();
    const started = Date.now();
    const res = await request(app)
      .get("/api/v2/courses?search=" + encodeURIComponent("(a+)+$"));

    expect(res.status).toBe(200);
    expect(res.body.courses).toEqual([]);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  // Metacharacters must not act as wildcards, and escaping must not be so
  // aggressive that genuine queries break. Seeding a title with a literal dot
  // catches both failure modes: a real "Node.js" search must still find it, and
  // a bare "." must match ONLY that dotted title — not every course (as a regex
  // wildcard would) and not nothing (as an over-escaped/mangled term would).
  it("treats regex metacharacters in the search term literally", async () => {
    const { instructor, web } = await seedCatalog();
    await makeCourse({
      instructorId: instructor.user.id,
      categoryId: String(web._id),
      title: "Node.js Basics",
    });

    // Positive case: a realistic query containing a dot still matches.
    const hit = await request(app)
      .get("/api/v2/courses?search=" + encodeURIComponent("Node.js"));
    expect(hit.status).toBe(200);
    expect(hit.body.courses).toHaveLength(1);
    expect(hit.body.courses[0].title).toBe("Node.js Basics");

    // "." is a literal dot, not a wildcard: it matches only the dotted title,
    // not the other two seeded courses.
    const dot = await request(app)
      .get("/api/v2/courses?search=" + encodeURIComponent("."));
    expect(dot.status).toBe(200);
    expect(dot.body.courses).toHaveLength(1);
    expect(dot.body.courses[0].title).toBe("Node.js Basics");
  });

  // Security regression: a course's `students` array is the list of enrolled-
  // user ObjectIds. The list endpoint fanned that leak across the WHOLE catalog
  // — every course's roster in a single anonymous request. No course in the
  // list may carry it; each must report only a numeric studentCount.
  it("never leaks any course's students array", async () => {
    const { react } = await seedCatalog();
    const student = await makeUser(app);
    await request(app)
      .post(`/api/v2/courses/${react._id}/enroll`)
      .set(auth(student.token))
      .expect(200);

    const res = await request(app).get("/api/v2/courses");
    expect(res.status).toBe(200);
    expect(res.body.courses.length).toBeGreaterThan(0);
    for (const c of res.body.courses) {
      expect(c.students).toBeUndefined();
      expect(typeof c.studentCount).toBe("number");
    }
    // The one enrolled course reports its single student as a count.
    const enrolled = res.body.courses.find(
      (c: { _id: string }) => c._id === String(react._id)
    );
    expect(enrolled.studentCount).toBe(1);
  });
});

// A draft course is the instructor's private work-in-progress. It must be
// invisible everywhere EXCEPT to its own instructor on getCourse — and every
// denial must be a 404 indistinguishable from a nonexistent id, never a 403
// that would confirm to an id-probing caller that something hidden exists.
describe("draft courses", () => {
  async function seedDraft() {
    const { instructor, web } = await seedCatalog();
    const draft = await makeCourse({
      instructorId: instructor.user.id,
      categoryId: String(web._id),
      title: "Unfinished Draft",
      status: "draft",
    });
    return { instructor, web, draft };
  }

  it("never appear in the public catalog", async () => {
    const { instructor } = await seedDraft();
    // Anonymous browse, filtered browse and search must all miss the draft —
    // and even the owner's own token doesn't surface it in the catalog.
    const anon = await request(app).get("/api/v2/courses");
    expect(anon.status).toBe(200);
    expect(anon.body.courses.map((c: { title: string }) => c.title))
      .not.toContain("Unfinished Draft");

    const search = await request(app).get("/api/v2/courses?search=unfinished");
    expect(search.body.courses).toEqual([]);

    const owned = await request(app).get("/api/v2/courses").set(auth(instructor.token));
    expect(owned.body.courses.map((c: { title: string }) => c.title))
      .not.toContain("Unfinished Draft");
  });

  it("return 404 (not 403) to anonymous callers on getCourse", async () => {
    const { draft } = await seedDraft();
    const res = await request(app).get(`/api/v2/courses/${draft._id}`);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Course not found");
  });

  it("return 404 (not 403) to other authenticated users, instructors included", async () => {
    const { draft } = await seedDraft();
    const student = await makeUser(app);
    const rival = await makeUser(app, { role: "instructor" });

    for (const actor of [student, rival]) {
      const res = await request(app)
        .get(`/api/v2/courses/${draft._id}`)
        .set(auth(actor.token));
      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Course not found");
    }
  });

  it("are visible to their own instructor", async () => {
    const { instructor, draft } = await seedDraft();
    const res = await request(app)
      .get(`/api/v2/courses/${draft._id}`)
      .set(auth(instructor.token));

    expect(res.status).toBe(200);
    expect(res.body.course.title).toBe("Unfinished Draft");
    expect(res.body.course.status).toBe("draft");
  });

  it("cannot be enrolled in — 404, even for an authenticated student", async () => {
    const { draft } = await seedDraft();
    const student = await makeUser(app);
    const res = await request(app)
      .post(`/api/v2/courses/${draft._id}/enroll`)
      .set(auth(student.token));

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Course not found");
  });

  it("newly created courses start as drafts", async () => {
    const instructor = await makeUser(app, { role: "instructor" });
    const category = await makeCategory();
    const created = await request(app).post("/api/v2/courses").set(auth(instructor.token)).send({
      title: "Fresh Course",
      description: "Starts private",
      category: String(category._id),
      price: 100,
    });
    expect(created.status).toBe(201);
    expect(created.body.course.status).toBe("draft");

    // ...and therefore it is NOT in the catalog yet.
    const list = await request(app).get("/api/v2/courses?search=fresh");
    expect(list.body.courses).toEqual([]);
  });

  // optionalAuth: getCourse is a public route. A garbage/expired token must
  // degrade to anonymous viewing — not bounce the request with a 401.
  it("a malformed token on the public getCourse route degrades to anonymous, never 401", async () => {
    const { react } = await seedCatalog();
    const res = await request(app)
      .get(`/api/v2/courses/${react._id}`)
      .set({ Authorization: "Bearer not-a-real-token" });

    expect(res.status).toBe(200);
    expect(res.body.course.title).toBe("React from Zero");
  });
});

describe("GET /api/v2/courses/mine", () => {
  it("returns the caller's own courses — drafts AND published", async () => {
    const { instructor, web } = await seedCatalog();
    await makeCourse({
      instructorId: instructor.user.id,
      categoryId: String(web._id),
      title: "My Secret Draft",
      status: "draft",
    });

    const res = await request(app).get("/api/v2/courses/mine").set(auth(instructor.token));

    expect(res.status).toBe(200);
    // Unlike the public catalog, the dashboard shows work-in-progress too:
    // 2 published from seedCatalog + 1 draft.
    expect(res.body.courses).toHaveLength(3);
    expect(res.body.courses.map((c: { title: string }) => c.title))
      .toContain("My Secret Draft");
  });

  it("never includes another instructor's courses", async () => {
    const { web } = await seedCatalog(); // seeds 2 courses for a different instructor
    const other = await makeUser(app, { role: "instructor" });
    await makeCourse({
      instructorId: other.user.id,
      categoryId: String(web._id),
      title: "Only Mine",
    });

    const res = await request(app).get("/api/v2/courses/mine").set(auth(other.token));

    expect(res.status).toBe(200);
    expect(res.body.courses).toHaveLength(1);
    expect(res.body.courses[0].title).toBe("Only Mine");
  });

  it("requires authentication — 401 for anonymous callers", async () => {
    const res = await request(app).get("/api/v2/courses/mine");
    expect(res.status).toBe(401);
  });

  it("is instructor-only — students get 403", async () => {
    const student = await makeUser(app);
    const res = await request(app).get("/api/v2/courses/mine").set(auth(student.token));
    expect(res.status).toBe(403);
  });

  // Route-ordering regression guard: "/mine" is registered before "/:id". If
  // that order ever flips, Express would route this request into getCourse,
  // treat "mine" as a course id and 404 — the assertions above would fail, but
  // this pins the failure mode down explicitly for whoever breaks it.
  it("is not swallowed by the /:id param route", async () => {
    const instructor = await makeUser(app, { role: "instructor" });
    const res = await request(app).get("/api/v2/courses/mine").set(auth(instructor.token));
    expect(res.status).toBe(200);
    expect(res.body.courses).toEqual([]);
  });

  it("serializes through serializeCourse — studentCount, never the students array", async () => {
    const { instructor, react } = await seedCatalog();
    const student = await makeUser(app);
    await request(app).post(`/api/v2/courses/${react._id}/enroll`).set(auth(student.token));

    const res = await request(app).get("/api/v2/courses/mine").set(auth(instructor.token));

    expect(res.status).toBe(200);
    const enrolled = res.body.courses.find((c: { title: string }) => c.title === "React from Zero");
    expect(enrolled.studentCount).toBe(1);
    expect(enrolled.students).toBeUndefined();
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

  // Security regression: getCourse used to serialize a course's `students`
  // array straight to any anonymous caller, exposing exactly who was enrolled.
  // Seed one enrollment so the array would be non-empty if it leaked, then
  // assert only the count survives. serializeCourse() strips it in one place.
  it("exposes studentCount and never the raw students array", async () => {
    const { react } = await seedCatalog();
    const student = await makeUser(app);
    await request(app)
      .post(`/api/v2/courses/${react._id}/enroll`)
      .set(auth(student.token))
      .expect(200);

    const res = await request(app).get(`/api/v2/courses/${react._id}`);
    expect(res.status).toBe(200);
    expect(res.body.course.studentCount).toBe(1);
    expect(res.body.course.students).toBeUndefined();
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

    // ...and the course reflects the enrollment as a COUNT — never the raw
    // student ObjectIds (the students-leak tests below guard this in detail).
    const course = await request(app).get(`/api/v2/courses/${react._id}`);
    expect(course.body.course.studentCount).toBe(1);
    expect(course.body.course.students).toBeUndefined();
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
