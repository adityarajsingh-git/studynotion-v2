import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { signToken } from "../utils/jwt";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signup(req: Request, res: Response) {
  const { name, email, password, role } = req.body ?? {};
  if (!name || !email || !password)
    return res.status(400).json({ success: false, message: "name, email and password are required" });
  if (!EMAIL_RE.test(email))
    return res.status(400).json({ success: false, message: "Invalid email" });
  if (String(password).length < 6)
    return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });

  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ success: false, message: "Email already registered" });

  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    password: hash,
    role: role === "instructor" ? "instructor" : "student",
  });

  const token = signToken({ id: String(user._id), role: user.role });
  return res.status(201).json({
    success: true,
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body ?? {};
  if (!email || !password)
    return res.status(400).json({ success: false, message: "email and password are required" });

  const user = await User.findOne({ email }).select("+password");
  if (!user) return res.status(401).json({ success: false, message: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ success: false, message: "Invalid credentials" });

  const token = signToken({ id: String(user._id), role: user.role });
  return res.json({
    success: true,
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
}

export async function me(req: Request, res: Response) {
  const user = await User.findById(req.user!.id).populate("enrolledCourses", "title price thumbnailColor");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  return res.json({
    success: true,
    user: {
      id: user._id, name: user.name, email: user.email, role: user.role,
      enrolledCourses: user.enrolledCourses,
    },
  });
}
