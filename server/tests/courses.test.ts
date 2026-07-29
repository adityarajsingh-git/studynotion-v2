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

  // `category` is an ObjectId ref that must point at a REAL Category — a
  // valid-but-nonexistent id would store a dangling ref that populate() turns
  // into null (empty category badge in the UI).
  it("returns 400 for a valid-but-nonexistent category", async () => {
    const instructor = await makeUser(app, { role: "instructor" });
    const res = await request(app).post("/api/v2/courses").set(auth(instructor.token))
      .send({ title: "X", description: "Y", category: String(new Types.ObjectId()), price: 10 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Category not found");
  });

  // A malformed id can't reference anything either — same 400, and no
  // CastError leaking out as a 500.
  it("returns 400 for a malformed category id", async () => {
    const instructor = await makeUser(app, { role: "instructor" });
    const res = await request(app).post("/api/v2/courses").set(auth(instructor.token))
      .send({ title: "X", description: "Y", category: "abc", price: 10 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Category not found");
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

describe("PATCH /api/v2/courses/:id", () => {
  async function seedOwned(status: "draft" | "published" = "published") {
    const owner = await makeUser(app, { role: "instructor" });
    const category = await makeCategory("Web Development");
    const course = await makeCourse({
      instructorId: owner.user.id, categoryId: String(category._id), title: "React from Zero", status,
    });
    return { owner, category, course };
  }

  // The happy path: the owning instructor edits whitelisted fields and the
  // changes both come back in the response and persist.
  it("lets the owner update their own course", async () => {
    const { owner, course } = await seedOwned();
    const res = await request(app)
      .patch(`/api/v2/courses/${course._id}`)
      .set(auth(owner.token))
      .send({ title: "React from Zero, 2nd Edition", price: 599 });

    expect(res.status).toBe(200);
    expect(res.body.course.title).toBe("React from Zero, 2nd Edition");
    expect(res.body.course.price).toBe(599);

    const fetched = await request(app).get(`/api/v2/courses/${course._id}`);
    expect(fetched.body.course.title).toBe("React from Zero, 2nd Edition");
  });

  // Broken-access-control guard: requireRole("instructor") passes for ANY
  // instructor, so the ownership check must reject a rival. The course is
  // published (publicly listed), so hiding it with a 404 would be a lie — 403.
  it("returns 403 when another instructor targets a published course", async () => {
    const { course } = await seedOwned("published");
    const rival = await makeUser(app, { role: "instructor" });
    const res = await request(app)
      .patch(`/api/v2/courses/${course._id}`)
      .set(auth(rival.token))
      .send({ title: "Hijacked" });

    expect(res.status).toBe(403);
    // ...and nothing was written.
    const fetched = await request(app).get(`/api/v2/courses/${course._id}`);
    expect(fetched.body.course.title).toBe("React from Zero");
  });

  // A draft is private: a 403 would confirm to a rival that the hidden course
  // exists, so a non-owner gets the same 404 as a nonexistent id.
  it("returns 404 when another instructor targets a draft course", async () => {
    const { course } = await seedOwned("draft");
    const rival = await makeUser(app, { role: "instructor" });
    const res = await request(app)
      .patch(`/api/v2/courses/${course._id}`)
      .set(auth(rival.token))
      .send({ title: "Sniffed" });
    expect(res.status).toBe(404);
  });

  // Students never clear the role gate, regardless of ownership questions.
  it("returns 403 for a student", async () => {
    const { course } = await seedOwned();
    const student = await makeUser(app);
    const res = await request(app)
      .patch(`/api/v2/courses/${course._id}`)
      .set(auth(student.token))
      .send({ title: "Nope" });
    expect(res.status).toBe(403);
  });

  // No token at all fails before any role or ownership logic runs.
  it("returns 401 for anonymous requests", async () => {
    const { course } = await seedOwned();
    const res = await request(app).patch(`/api/v2/courses/${course._id}`).send({ title: "Nope" });
    expect(res.status).toBe(401);
  });

  // Mass-assignment guard: `instructor` is not on the whitelist, so even the
  // owner cannot reassign the course — PATCH { instructor: <id> } must never
  // be a way to transfer (or steal) ownership.
  it("ignores an instructor field in the payload — ownership cannot change", async () => {
    const { owner, course } = await seedOwned();
    const rival = await makeUser(app, { role: "instructor" });
    const res = await request(app)
      .patch(`/api/v2/courses/${course._id}`)
      .set(auth(owner.token))
      .send({ instructor: rival.user.id, title: "Still mine" });

    expect(res.status).toBe(200);
    expect(res.body.course.title).toBe("Still mine");
    expect(String(res.body.course.instructor)).toBe(owner.user.id);
  });

  // Mass-assignment guard: `students` is not on the whitelist either, so
  // enrollments cannot be forged around the enroll endpoint. Unknown fields
  // are silently ignored per REST convention — not a 400.
  it("ignores a students field in the payload", async () => {
    const { owner, course } = await seedOwned();
    const res = await request(app)
      .patch(`/api/v2/courses/${course._id}`)
      .set(auth(owner.token))
      .send({ students: [String(new Types.ObjectId())] });

    expect(res.status).toBe(200);
    expect(res.body.course.studentCount).toBe(0);
  });

  // `status` IS whitelisted on purpose: flipping draft → "published" is the
  // publish flow, and the course must surface in the public catalog after it.
  it("publishes a draft via PATCH { status: 'published' }", async () => {
    const { owner, course } = await seedOwned("draft");

    const before = await request(app).get("/api/v2/courses");
    expect(before.body.courses).toHaveLength(0);

    const res = await request(app)
      .patch(`/api/v2/courses/${course._id}`)
      .set(auth(owner.token))
      .send({ status: "published" });
    expect(res.status).toBe(200);

    const after = await request(app).get("/api/v2/courses");
    expect(after.body.courses).toHaveLength(1);
    expect(after.body.courses[0].title).toBe("React from Zero");
  });

  // status is an enum of exactly two states — anything else is a client error.
  it("returns 400 for an invalid status value", async () => {
    const { owner, course } = await seedOwned();
    const res = await request(app)
      .patch(`/api/v2/courses/${course._id}`)
      .set(auth(owner.token))
      .send({ status: "archived" });
    expect(res.status).toBe(400);
  });

  // Dangling-ref guard on update: the category is verified BEFORE the
  // whitelist loop writes anything, so a rejected PATCH leaves the course
  // completely untouched — old category AND the other fields in the payload.
  it("returns 400 for a valid-but-nonexistent category and keeps the old one", async () => {
    const { owner, category, course } = await seedOwned();
    const res = await request(app)
      .patch(`/api/v2/courses/${course._id}`)
      .set(auth(owner.token))
      .send({ category: String(new Types.ObjectId()), title: "Should not stick" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Category not found");

    const fetched = await request(app).get(`/api/v2/courses/${course._id}`);
    expect(String(fetched.body.course.category._id)).toBe(String(category._id));
    expect(fetched.body.course.title).toBe("React from Zero");
  });

  // Malformed category strings get the same 400 as nonexistent ones.
  it("returns 400 for a malformed category id", async () => {
    const { owner, course } = await seedOwned();
    const res = await request(app)
      .patch(`/api/v2/courses/${course._id}`)
      .set(auth(owner.token))
      .send({ category: "abc" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Category not found");
  });

  // The guard must not break legitimate re-categorisation: an existing
  // category is still accepted and actually applied.
  it("still updates to another existing category with 200", async () => {
    const { owner, course } = await seedOwned();
    const other = await makeCategory("Data & Databases");
    const res = await request(app)
      .patch(`/api/v2/courses/${course._id}`)
      .set(auth(owner.token))
      .send({ category: String(other._id) });

    expect(res.status).toBe(200);

    const fetched = await request(app).get(`/api/v2/courses/${course._id}`);
    expect(fetched.body.course.category.name).toBe("Data & Databases");
  });

  // A malformed ObjectId can't exist, so it reads as "not found" rather than
  // leaking a CastError as a 500.
  it("returns 404 for a malformed course id", async () => {
    const instructor = await makeUser(app, { role: "instructor" });
    const res = await request(app)
      .patch("/api/v2/courses/abc")
      .set(auth(instructor.token))
      .send({ title: "x" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/v2/courses/:id", () => {
  // The owner can delete a course nobody is enrolled in, and it's really gone.
  it("lets the owner delete their own course", async () => {
    const owner = await makeUser(app, { role: "instructor" });
    const category = await makeCategory("Web Development");
    const course = await makeCourse({ instructorId: owner.user.id, categoryId: String(category._id) });

    const res = await request(app).delete(`/api/v2/courses/${course._id}`).set(auth(owner.token));
    expect(res.status).toBe(200);

    const fetched = await request(app).get(`/api/v2/courses/${course._id}`);
    expect(fetched.status).toBe(404);
  });

  // Referential-integrity guard: enrolled users' enrolledCourses point at this
  // id, so deletion would orphan them and null out dashboard populate(). The
  // instructor is steered toward unpublishing instead.
  it("returns 409 when students are enrolled", async () => {
    const { instructor, react } = await seedCatalog();
    const student = await makeUser(app);
    await request(app).post(`/api/v2/courses/${react._id}/enroll`).set(auth(student.token)).expect(200);

    const res = await request(app).delete(`/api/v2/courses/${react._id}`).set(auth(instructor.token));
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Cannot delete a course with enrolled students — unpublish it instead");

    // The course must still be intact for the enrolled student.
    const fetched = await request(app).get(`/api/v2/courses/${react._id}`);
    expect(fetched.status).toBe(200);
  });

  // Same malformed-id discipline as PATCH: impossible id → 404, not a 500.
  it("returns 404 for a malformed course id", async () => {
    const instructor = await makeUser(app, { role: "instructor" });
    const res = await request(app).delete("/api/v2/courses/abc").set(auth(instructor.token));
    expect(res.status).toBe(404);
  });
});
