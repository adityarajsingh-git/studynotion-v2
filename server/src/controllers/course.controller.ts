import { Request, Response } from "express";
import { Types } from "mongoose";
import { Category } from "../models/Category";
import { Course, ICourse, ILesson } from "../models/Course";
import { User } from "../models/User";

// User-supplied search text is fed into a MongoDB $regex below. Escaping the
// regex metacharacters turns the input into a literal substring match — this
// keeps results intuitive AND prevents ReDoS: a term like "(a+)+$" would
// otherwise compile to a catastrophic-backtracking pattern that pins the event
// loop and takes the whole server down.
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The single course shape the API hands to clients. It deliberately DROPS the
 * `students` array — the raw list of enrolled-user ObjectIds — and exposes only
 * its size as `studentCount`. Serializing that array leaked the identity of
 * every enrolled user to any anonymous caller (and listCourses fanned it out
 * across the whole catalog in one request). Every course-returning endpoint
 * funnels through here, so a new handler can't reintroduce the leak by shaping
 * its own response — the same discipline serializeUser() enforces for auth.
 */
function serializeCourse(course: ICourse) {
  const { students, ...rest } = course.toObject();
  return { ...rest, studentCount: Array.isArray(students) ? students.length : 0 };
}

export async function listCourses(req: Request, res: Response) {
  const { category, search } = req.query;
  // The public catalog only ever shows published courses. Drafts are the
  // instructor's private work-in-progress — they're reachable solely through
  // getCourse, which gates per-course access to the owning instructor.
  const filter: Record<string, unknown> = { status: "published" };

  if (category) {
    if (!Types.ObjectId.isValid(String(category)))
      return res.status(400).json({ success: false, message: "Invalid category filter" });
    filter.category = category;
  }
  if (search) filter.title = { $regex: escapeRegex(String(search)), $options: "i" };

  const courses = await Course.find(filter)
    .populate("instructor", "name")
    .populate("category", "name")
    .sort("-createdAt");
  res.json({ success: true, courses: courses.map(serializeCourse) });
}

/**
 * The instructor's own dashboard list. Unlike the public catalog this includes
 * drafts — they're the caller's own work-in-progress, so there's nothing to
 * hide — but it NEVER widens beyond `instructor: req.user.id`. The ownership
 * filter lives in the query itself (not a post-fetch check) so another
 * instructor's courses can't even be fetched, let alone leak through a
 * serialization slip.
 */
export async function getMyCourses(req: Request, res: Response) {
  const courses = await Course.find({ instructor: req.user!.id })
    .populate("instructor", "name")
    .populate("category", "name")
    .sort("-createdAt");
  res.json({ success: true, courses: courses.map(serializeCourse) });
}

export async function getCourse(req: Request, res: Response) {
  // A non-ObjectId can never match a document, so treat it as "not found"
  // rather than letting Mongoose raise a CastError.
  if (!Types.ObjectId.isValid(req.params.id))
    return res.status(404).json({ success: false, message: "Course not found" });

  const course = await Course.findById(req.params.id)
    .populate("instructor", "name")
    .populate("category", "name");
  if (!course) return res.status(404).json({ success: false, message: "Course not found" });

  // A draft is visible ONLY to its own instructor (the route runs optionalAuth,
  // so req.user is set when a valid token came along). Everyone else gets the
  // same 404 as a nonexistent id — a 403 would confirm to anyone probing ids
  // that a hidden course exists.
  if (course.status !== "published") {
    // `instructor` is populated above, so the ObjectId lives at `_id`.
    const owner = course.instructor as unknown as { _id?: unknown } | null;
    const ownerId = owner?._id ? String(owner._id) : null;
    if (!req.user || !ownerId || req.user.id !== ownerId)
      return res.status(404).json({ success: false, message: "Course not found" });
  }

  res.json({ success: true, course: serializeCourse(course) });
}

/**
 * `category` is an ObjectId ref, and Mongoose will happily store a dangling
 * one — populate() then yields null and the UI shows an empty category badge.
 * listCourses already validates its filter this way; both write paths must do
 * the same before a course can be bound to a category that doesn't exist.
 * Malformed strings and valid-but-nonexistent ids are the same client error.
 */
async function categoryMissing(id: unknown): Promise<boolean> {
  return !Types.ObjectId.isValid(String(id)) || !(await Category.exists({ _id: id }));
}

export async function createCourse(req: Request, res: Response) {
  const { title, description, category, price, thumbnailColor, lessons } = req.body ?? {};
  if (!title || !description || !category || price === undefined)
    return res.status(400).json({ success: false, message: "title, description, category and price are required" });

  if (await categoryMissing(category))
    return res.status(400).json({ success: false, message: "Category not found" });

  const course = await Course.create({
    title, description, category,
    price: Number(price),
    thumbnailColor: thumbnailColor || "#d9a54f",
    lessons: Array.isArray(lessons) ? lessons : [],
    instructor: req.user!.id,
  });
  res.status(201).json({ success: true, course: serializeCourse(course) });
}

/**
 * The fields a PATCH is allowed to touch — a whitelist, so everything else in
 * req.body is silently ignored (REST convention: unknown members are not an
 * error). Piping req.body straight into an update would be mass assignment:
 * PATCH { instructor: "<attacker-id>" } would steal the course outright, and
 * PATCH { students: [...] } would forge enrollments without touching the
 * enroll endpoint. `lessons` stays blocked until the course-builder roadmap
 * item lands; `_id`/`createdAt`/`updatedAt` are Mongoose's to manage.
 *
 * `status` IS updatable on purpose — flipping it between "draft" and
 * "published" is the publish/unpublish flow.
 */
const UPDATABLE_FIELDS = ["title", "description", "category", "price", "thumbnailColor", "status"] as const;

/**
 * requireRole("instructor") only proves the caller is SOME instructor —
 * without this second check any instructor could edit or delete a rival's
 * course (broken access control). The denial status depends on visibility:
 * a draft is private, so a non-owner gets the same 404 as a nonexistent id
 * (a 403 would confirm a hidden course exists — same discipline as
 * getCourse/enroll); a published course is already public in the catalog,
 * so a 404 would be a lie — 403 is the honest answer.
 */
function ownershipDenial(course: ICourse, userId: string): 403 | 404 | null {
  if (String(course.instructor) === userId) return null;
  return course.status === "published" ? 403 : 404;
}

export async function updateCourse(req: Request, res: Response) {
  if (!Types.ObjectId.isValid(req.params.id))
    return res.status(404).json({ success: false, message: "Course not found" });

  const course = await Course.findById(req.params.id);
  if (!course) return res.status(404).json({ success: false, message: "Course not found" });

  const denial = ownershipDenial(course, req.user!.id);
  if (denial === 404) return res.status(404).json({ success: false, message: "Course not found" });
  if (denial === 403) return res.status(403).json({ success: false, message: "You do not own this course" });

  const body = req.body ?? {};

  // status doubles as the publish switch, so reject anything outside the enum
  // up front with a clear message rather than a raw Mongoose enum error.
  if (body.status !== undefined && body.status !== "draft" && body.status !== "published")
    return res.status(400).json({ success: false, message: 'status must be "draft" or "published"' });

  // Same dangling-ref guard as createCourse — verified BEFORE the whitelist
  // loop writes anything, so a rejected PATCH leaves the course untouched.
  if (body.category !== undefined && (await categoryMissing(body.category)))
    return res.status(400).json({ success: false, message: "Category not found" });

  for (const field of UPDATABLE_FIELDS)
    if (body[field] !== undefined) course.set(field, body[field]);

  // save() runs the schema validators, so a bad category id / negative price /
  // overlong title still surfaces as a ValidationError → 400 via errorHandler.
  await course.save();
  res.json({ success: true, course: serializeCourse(course) });
}

export async function deleteCourse(req: Request, res: Response) {
  if (!Types.ObjectId.isValid(req.params.id))
    return res.status(404).json({ success: false, message: "Course not found" });

  const course = await Course.findById(req.params.id);
  if (!course) return res.status(404).json({ success: false, message: "Course not found" });

  const denial = ownershipDenial(course, req.user!.id);
  if (denial === 404) return res.status(404).json({ success: false, message: "Course not found" });
  if (denial === 403) return res.status(403).json({ success: false, message: "You do not own this course" });

  // Referential integrity: every enrolled user's User.enrolledCourses points
  // at this id. Deleting would orphan those references and make the dashboard
  // populate() come back null. Unpublishing hides the course without breaking
  // anyone's library, so steer the instructor there instead.
  if (course.students.length > 0)
    return res.status(409).json({
      success: false,
      message: "Cannot delete a course with enrolled students — unpublish it instead",
    });

  await course.deleteOne();
  res.json({ success: true, message: "Course deleted" });
}

/**
 * Shared preamble for the lesson endpoints: resolve the course and run it
 * through the SAME ownership gate as updateCourse/deleteCourse — the denial
 * semantics (draft → 404, published → 403) live in ownershipDenial and are
 * not duplicated here. Writes the error response itself and returns null so
 * each handler needs only a one-line guard.
 */
async function findOwnedCourse(req: Request, res: Response): Promise<ICourse | null> {
  if (!Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ success: false, message: "Course not found" });
    return null;
  }
  const course = await Course.findById(req.params.id);
  if (!course) {
    res.status(404).json({ success: false, message: "Course not found" });
    return null;
  }
  const denial = ownershipDenial(course, req.user!.id);
  if (denial === 404) {
    res.status(404).json({ success: false, message: "Course not found" });
    return null;
  }
  if (denial === 403) {
    res.status(403).json({ success: false, message: "You do not own this course" });
    return null;
  }
  return course;
}

/**
 * Validates the only two fields a lesson payload may set — everything else in
 * the body is ignored (same whitelist discipline as UPDATABLE_FIELDS, so a
 * lesson can never smuggle arbitrary keys into the document). `title` is
 * mandatory on create but optional on edit; `durationMin` is always optional
 * (create defaults it to 0).
 */
function lessonPayloadError(body: Record<string, unknown>, requireTitle: boolean): string | null {
  const { title, durationMin } = body;
  if (title === undefined) {
    if (requireTitle) return "title is required";
  } else if (typeof title !== "string" || !title.trim()) {
    return "title must be a non-empty string";
  } else if (title.trim().length > 200) {
    return "title must be at most 200 characters";
  }
  if (
    durationMin !== undefined &&
    (typeof durationMin !== "number" || !Number.isInteger(durationMin) || durationMin < 0)
  )
    return "durationMin must be a non-negative integer";
  return null;
}

export async function addLesson(req: Request, res: Response) {
  const course = await findOwnedCourse(req, res);
  if (!course) return;

  const body = req.body ?? {};
  const error = lessonPayloadError(body, true);
  if (error) return res.status(400).json({ success: false, message: error });

  course.lessons.push({
    title: (body.title as string).trim(),
    durationMin: (body.durationMin as number | undefined) ?? 0,
  } as ILesson);
  await course.save();

  // Mongoose assigned the _id during push — hand the subdocument back so the
  // client can immediately target the new lesson for edit/delete/reorder.
  const lesson = course.lessons[course.lessons.length - 1];
  res.status(201).json({ success: true, lesson });
}

export async function updateLesson(req: Request, res: Response) {
  const course = await findOwnedCourse(req, res);
  if (!course) return;

  // Lookup by string comparison: a malformed lessonId simply matches nothing,
  // so it collapses into the same 404 as a nonexistent one (no CastError).
  const lesson = course.lessons.find((l) => String(l._id) === req.params.lessonId);
  if (!lesson) return res.status(404).json({ success: false, message: "Lesson not found" });

  const body = req.body ?? {};
  const error = lessonPayloadError(body, false);
  if (error) return res.status(400).json({ success: false, message: error });

  if (body.title !== undefined) lesson.title = (body.title as string).trim();
  if (body.durationMin !== undefined) lesson.durationMin = body.durationMin as number;
  await course.save();
  res.json({ success: true, lesson });
}

export async function deleteLesson(req: Request, res: Response) {
  const course = await findOwnedCourse(req, res);
  if (!course) return;

  const index = course.lessons.findIndex((l) => String(l._id) === req.params.lessonId);
  if (index === -1) return res.status(404).json({ success: false, message: "Lesson not found" });

  course.lessons.splice(index, 1);
  await course.save();
  res.json({ success: true, lessons: course.lessons });
}

export async function reorderLessons(req: Request, res: Response) {
  const course = await findOwnedCourse(req, res);
  if (!course) return;

  const { order } = req.body ?? {};
  if (!Array.isArray(order))
    return res.status(400).json({ success: false, message: "order must be an array of lesson ids" });

  // `order` must be an EXACT permutation of the current lesson ids. Anything
  // looser corrupts the course: a short list silently drops lessons, unknown
  // ids invent holes, duplicates clone entries. Checked BEFORE any mutation,
  // so a rejected reorder leaves the lessons array untouched.
  const current = course.lessons.map((l) => String(l._id));
  const requested = order.map(String);
  const isPermutation =
    requested.length === current.length &&
    new Set(requested).size === requested.length &&
    requested.every((id) => current.includes(id));
  if (!isPermutation)
    return res.status(400).json({
      success: false,
      message: "order must be an exact permutation of the course's lesson ids",
    });

  const byId = new Map(course.lessons.map((l) => [String(l._id), l]));
  course.lessons = requested.map((id) => byId.get(id)!);
  await course.save();
  res.json({ success: true, lessons: course.lessons });
}

export async function enroll(req: Request, res: Response) {
  if (!Types.ObjectId.isValid(req.params.id))
    return res.status(404).json({ success: false, message: "Course not found" });

  const course = await Course.findById(req.params.id);
  if (!course) return res.status(404).json({ success: false, message: "Course not found" });

  // Drafts aren't enrollable. Same 404 as a nonexistent id (never 403) so an
  // authenticated user can't probe ids to learn a hidden course exists.
  if (course.status !== "published")
    return res.status(404).json({ success: false, message: "Course not found" });

  const userId = req.user!.id;
  if (course.students.some((s) => String(s) === userId))
    return res.status(409).json({ success: false, message: "Already enrolled" });

  course.students.push(userId as never);
  await course.save();

  await User.findByIdAndUpdate(userId, { $addToSet: { enrolledCourses: course._id } });

  res.json({ success: true, message: "Enrolled — payment flow lands in Week 3 (see ROADMAP.md)" });
}
