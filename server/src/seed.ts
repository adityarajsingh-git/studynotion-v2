/** Seed demo data: run `npm run seed` after setting MONGODB_URL in .env */
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { env } from "./config/env";
import { User } from "./models/User";
import { Category } from "./models/Category";
import { Course } from "./models/Course";

const CATEGORIES = [
  { name: "Web Development", description: "Frontend, backend and everything between" },
  { name: "Mobile Development", description: "Android & iOS apps" },
  { name: "Data & Databases", description: "SQL, NoSQL and data modelling" },
];

const COURSES = [
  { title: "React from Zero to Deploy", price: 499, color: "#d9a54f", cat: 0, lessons: 12 },
  { title: "TypeScript for React Developers", price: 399, color: "#4f8dd9", cat: 0, lessons: 9 },
  { title: "React Native: One Codebase, Two Stores", price: 599, color: "#4fd98d", cat: 1, lessons: 14 },
  { title: "REST API Design that Scales", price: 449, color: "#c95d5d", cat: 0, lessons: 10 },
  { title: "MongoDB Data Modelling in Practice", price: 349, color: "#8d5dc9", cat: 2, lessons: 8 },
  { title: "MySQL for Application Developers", price: 299, color: "#d97f4f", cat: 2, lessons: 7 },
];

async function seed() {
  if (!env.mongoUrl) throw new Error("Set MONGODB_URL in server/.env first");
  await mongoose.connect(env.mongoUrl);
  console.log("connected — seeding…");

  await Promise.all([User.deleteMany({}), Category.deleteMany({}), Course.deleteMany({})]);

  const cats = await Category.insertMany(CATEGORIES);
  const instructor = await User.create({
    name: "Demo Instructor",
    email: "instructor@demo.test",
    password: await bcrypt.hash("demo1234", 10),
    role: "instructor",
  });
  // A ready-made student account: the seed wipes ALL users (deleteMany above),
  // so without this every re-seed forces a manual signup before the enroll
  // flow can even be exercised.
  await User.create({
    name: "Demo Student",
    email: "student@demo.test",
    password: await bcrypt.hash("demo1234", 10),
    role: "student",
  });

  await Course.insertMany(
    COURSES.map((c) => ({
      title: c.title,
      description: `A hands-on course: ${c.title}. Built as seed data for StudyNotion v2 — replace with real content from the course builder (Week 2 of the roadmap).`,
      instructor: instructor._id,
      category: cats[c.cat]._id,
      price: c.price,
      thumbnailColor: c.color,
      lessons: Array.from({ length: c.lessons }, (_, i) => ({ title: `Lesson ${i + 1}`, durationMin: 8 + (i % 5) * 3 })),
      // Demo catalog must actually be browsable — without this the schema's
      // "draft" default would hide every seeded course from listCourses.
      status: "published" as const,
    }))
  );

  console.log(`✅ seeded: ${cats.length} categories, ${COURSES.length} courses, 2 users — instructor@demo.test / demo1234 (instructor), student@demo.test / demo1234 (student)`);
  await mongoose.disconnect();
}

seed().catch((e) => { console.error(e); process.exit(1); });
