import { Request, Response } from "express";
import { Types } from "mongoose";
import { Course } from "../models/Course";
import { User } from "../models/User";

export async function listCourses(req: Request, res: Response) {
  const { category, search } = req.query;
  const filter: Record<string, unknown> = {};

  if (category) {
    if (!Types.ObjectId.isValid(String(category)))
      return res.status(400).json({ success: false, message: "Invalid category filter" });
    filter.category = category;
  }
  if (search) filter.title = { $regex: String(search), $options: "i" };

  const courses = await Course.find(filter)
    .populate("instructor", "name")
    .populate("category", "name")
    .sort("-createdAt");
  res.json({ success: true, courses });
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
  res.json({ success: true, course });
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
  res.status(201).json({ success: true, course });
}

export async function enroll(req: Request, res: Response) {
  if (!Types.ObjectId.isValid(req.params.id))
    return res.status(404).json({ success: false, message: "Course not found" });

  const course = await Course.findById(req.params.id);
  if (!course) return res.status(404).json({ success: false, message: "Course not found" });

  const userId = req.user!.id;
  if (course.students.some((s) => String(s) === userId))
    return res.status(409).json({ success: false, message: "Already enrolled" });

  course.students.push(userId as never);
  await course.save();

  await User.findByIdAndUpdate(userId, { $addToSet: { enrolledCourses: course._id } });

  res.json({ success: true, message: "Enrolled — payment flow lands in Week 3 (see ROADMAP.md)" });
}
