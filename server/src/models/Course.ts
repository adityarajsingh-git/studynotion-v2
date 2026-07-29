import { Schema, model, Document, Types } from "mongoose";

export interface ILesson {
  // Mongoose gives every subdocument an _id automatically — declared here so
  // TypeScript can see it (the lesson endpoints target lessons by this id).
  _id: Types.ObjectId;
  title: string;
  durationMin: number;
}

export interface ICourse extends Document {
  title: string;
  description: string;
  instructor: Types.ObjectId;
  category: Types.ObjectId;
  price: number; // in INR
  thumbnailColor: string; // v2: CSS-generated thumbnails until media upload lands
  lessons: ILesson[];
  students: Types.ObjectId[];
  status: "draft" | "published";
  createdAt: Date;
  updatedAt: Date;
}

const courseSchema = new Schema<ICourse>(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, maxlength: 2000 },
    // category + instructor are indexed: the catalog filters by category on
    // every request, and instructor dashboards query by instructor.
    instructor: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    price: { type: Number, required: true, min: 0 },
    thumbnailColor: { type: String, default: "#d9a54f" },
    lessons: [{
      title: { type: String, required: true, trim: true, maxlength: 200 },
      durationMin: { type: Number, default: 0, min: 0 },
    }],
    students: [{ type: Schema.Types.ObjectId, ref: "User" }],
    // New courses start as private work-in-progress. Only "published" courses
    // appear in the catalog or accept enrollments; a draft is visible solely
    // to its own instructor. Indexed — listCourses filters on it every time.
    // NOTE: docs created before this field existed have no status at all and
    // vanish behind the catalog's published-only filter — re-run `npm run
    // seed` (or see the migration note in README.md) after deploying this.
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
  },
  { timestamps: true }
);

export const Course = model<ICourse>("Course", courseSchema);
