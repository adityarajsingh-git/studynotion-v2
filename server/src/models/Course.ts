import { Schema, model, Document, Types } from "mongoose";

export interface ILesson {
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
  createdAt: Date;
  updatedAt: Date;
}

const courseSchema = new Schema<ICourse>(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, maxlength: 2000 },
    instructor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    price: { type: Number, required: true, min: 0 },
    thumbnailColor: { type: String, default: "#d9a54f" },
    lessons: [{ title: { type: String, required: true }, durationMin: { type: Number, default: 0 } }],
    students: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export const Course = model<ICourse>("Course", courseSchema);
