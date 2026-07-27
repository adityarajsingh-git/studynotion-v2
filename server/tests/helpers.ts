import request from "supertest";
import { Express } from "express";
import { Category } from "../src/models/Category";
import { Course } from "../src/models/Course";

export interface Actor {
  token: string;
  user: { id: string; name: string; email: string; role: string };
}

/** Signs a user up through the real endpoint and returns their token. */
export async function makeUser(
  app: Express,
  overrides: Partial<{ name: string; email: string; password: string; role: string }> = {}
): Promise<Actor> {
  const body = {
    name: "Test User",
    email: `user${Math.random().toString(36).slice(2, 10)}@example.com`,
    password: "secret123",
    role: "student",
    ...overrides,
  };
  const res = await request(app).post("/api/v2/auth/signup").send(body);
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${res.text}`);
  return { token: res.body.token, user: res.body.user };
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function makeCategory(name = "Web Development") {
  return Category.create({ name, description: "seeded in tests" });
}

export async function makeCourse(opts: {
  instructorId: string;
  categoryId: string;
  title?: string;
  price?: number;
  lessons?: { title: string; durationMin: number }[];
}) {
  return Course.create({
    title: opts.title ?? "A Test Course",
    description: "Course created for tests",
    instructor: opts.instructorId,
    category: opts.categoryId,
    price: opts.price ?? 499,
    lessons: opts.lessons ?? [{ title: "Lesson 1", durationMin: 30 }],
  });
}
