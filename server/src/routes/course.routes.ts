import { Router } from "express";
import { listCourses, getMyCourses, getCourse, createCourse, updateCourse, deleteCourse, enroll } from "../controllers/course.controller";
import { requireAuth, requireRole, optionalAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const r = Router();
r.get("/", asyncHandler(listCourses));
// MUST be registered before "/:id" — Express matches routes in order, so a
// later "/mine" would be swallowed by the id param and 404 as a bad ObjectId.
r.get("/mine", requireAuth, requireRole("instructor"), asyncHandler(getMyCourses));
r.get("/:id", optionalAuth, asyncHandler(getCourse));
r.post("/", requireAuth, requireRole("instructor"), asyncHandler(createCourse));
// Role gate first (any instructor), then the controller's ownership check
// narrows it to THIS course's instructor — role alone is not authorization.
r.patch("/:id", requireAuth, requireRole("instructor"), asyncHandler(updateCourse));
r.delete("/:id", requireAuth, requireRole("instructor"), asyncHandler(deleteCourse));
r.post("/:id/enroll", requireAuth, asyncHandler(enroll));
export default r;
