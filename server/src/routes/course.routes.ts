import { Router } from "express";
import { listCourses, getCourse, createCourse, enroll } from "../controllers/course.controller";
import { requireAuth, requireRole, optionalAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const r = Router();
r.get("/", asyncHandler(listCourses));
r.get("/:id", optionalAuth, asyncHandler(getCourse));
r.post("/", requireAuth, requireRole("instructor"), asyncHandler(createCourse));
r.post("/:id/enroll", requireAuth, asyncHandler(enroll));
export default r;
