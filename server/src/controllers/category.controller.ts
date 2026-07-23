import { Request, Response } from "express";
import { Category } from "../models/Category";

export async function listCategories(_req: Request, res: Response) {
  const categories = await Category.find().sort("name");
  res.json({ success: true, categories });
}

export async function createCategory(req: Request, res: Response) {
  const { name, description } = req.body ?? {};
  if (!name) return res.status(400).json({ success: false, message: "name is required" });
  const category = await Category.create({ name, description });
  res.status(201).json({ success: true, category });
}
