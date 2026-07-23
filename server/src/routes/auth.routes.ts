import { Router } from "express";
import { signup, login, me } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const r = Router();
r.post("/signup", asyncHandler(signup));
r.post("/login", asyncHandler(login));
r.get("/me", requireAuth, asyncHandler(me));
export default r;
