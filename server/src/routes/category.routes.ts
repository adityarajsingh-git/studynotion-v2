import { Router } from "express";
import { listCategories, createCategory } from "../controllers/category.controller";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const r = Router();
r.get("/", asyncHandler(listCategories));
r.post("/", requireAuth, requireRole("instructor"), asyncHandler(createCategory));
export default r;
