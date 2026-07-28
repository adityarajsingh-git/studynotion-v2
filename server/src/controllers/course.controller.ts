import { Request, Response } from "express";
import { Types } from "mongoose";
import { Course, ICourse } from "../models/Course";
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

export async function createCourse(req: Request, res: Response) {
  const { title, description, category, price, thumbnailColor, lessons } = req.body ?? {};
  if (!title || !description || !category || price === undefined)
    return res.status(400).json({ success: false, message: "title, description, category and price are required" });

  const course = await Course.create({
    title, description, category,
    price: Number(price),
    thumbnailColor: thumbnailColor || "#d9a54f",
    lessons: Array.isArray(lessons) ? lessons : [],
    instructor: req.user!.id,
  });
  res.status(201).json({ success: true, course: serializeCourse(course) });
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
