import { Schema, model, Document, Types } from "mongoose";

export type UserRole = "student" | "instructor";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string; // bcrypt hash
  role: UserRole;
  enrolledCourses: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["student", "instructor"], default: "student" },
    enrolledCourses: [{ type: Schema.Types.ObjectId, ref: "Course" }],
  },
  { timestamps: true }
);

export const User = model<IUser>("User", userSchema);
