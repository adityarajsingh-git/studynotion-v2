// Split deploys (client on Netlify, API on Render) point this at the API's
// public URL via VITE_API_URL — baked in at build time by Vite. Unset OR
// empty falls back to the same-origin path the dev proxy serves. `||` rather
// than `??` on purpose: copying client/.env.example leaves the var defined
// but empty, and a "" base would send requests to fetch("/courses").
const BASE = import.meta.env.VITE_API_URL || "/api/v2";

export interface EnrolledCourse { _id: string; title: string; price: number; thumbnailColor: string }

export interface ApiUser {
  id: string; name: string; email: string; role: "student" | "instructor";
  /** Always present — signup, login and /me all return the same user shape. */
  enrolledCourses: EnrolledCourse[];
}
/** _id lets the client target a lesson for edit/delete/reorder. */
export interface ApiLesson { _id: string; title: string; durationMin: number }

export interface ApiCourse {
  _id: string; title: string; description: string; price: number; thumbnailColor: string;
  instructor?: { name: string };
  /** populate() always includes _id — the edit form needs it to preselect the dropdown. */
  category?: { _id: string; name: string };
  lessons: ApiLesson[];
  /** Enrolled-user count. The server never sends the raw student ObjectIds. */
  studentCount: number;
  /** The server has sent this since the draft/publish flow landed — the
   * instructor dashboard needs it for the draft/published badge. */
  status: "draft" | "published";
}

/** Body for POST /courses — the server's required create fields. */
export interface CoursePayload {
  title: string;
  description: string;
  /** Category ObjectId — must reference an existing category (server 400s otherwise). */
  category: string;
  price: number;
  thumbnailColor?: string;
}

/** PATCH /courses/:id accepts any subset, plus the publish switch. */
export type CourseUpdate = Partial<CoursePayload & { status: "draft" | "published" }>;

/** Body for lesson create/edit. durationMin is optional — the server defaults it to 0. */
export interface LessonPayload {
  title: string;
  durationMin?: number;
}

export function getToken() { return localStorage.getItem("sn2_token"); }
export function setToken(t: string | null) {
  if (t) localStorage.setItem("sn2_token", t); else localStorage.removeItem("sn2_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({ success: false, message: "Bad response" }));
  if (!res.ok || data.success === false) throw new Error(data.message || `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  signup: (body: { name: string; email: string; password: string; role: string }) =>
    request<{ token: string; user: ApiUser }>("/auth/signup", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: ApiUser }>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => request<{ user: ApiUser }>("/auth/me"),
  courses: (q = "") => request<{ courses: ApiCourse[] }>(`/courses${q}`),
  course: (id: string) => request<{ course: ApiCourse }>(`/courses/${id}`),
  categories: () => request<{ categories: { _id: string; name: string }[] }>("/categories"),
  enroll: (id: string) => request<{ message: string }>(`/courses/${id}/enroll`, { method: "POST" }),

  // ——— Instructor course builder ———
  // All authenticated: request() already attaches the Bearer token, so these
  // stay plain one-liners like everything above.
  myCourses: () => request<{ courses: ApiCourse[] }>("/courses/mine"),
  createCourse: (data: CoursePayload) =>
    request<{ course: ApiCourse }>("/courses", { method: "POST", body: JSON.stringify(data) }),
  updateCourse: (id: string, patch: CourseUpdate) =>
    request<{ course: ApiCourse }>(`/courses/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteCourse: (id: string) =>
    request<{ message: string }>(`/courses/${id}`, { method: "DELETE" }),
  addLesson: (courseId: string, data: LessonPayload) =>
    request<{ lesson: ApiLesson }>(`/courses/${courseId}/lessons`, { method: "POST", body: JSON.stringify(data) }),
  updateLesson: (courseId: string, lessonId: string, data: Partial<LessonPayload>) =>
    request<{ lesson: ApiLesson }>(`/courses/${courseId}/lessons/${lessonId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteLesson: (courseId: string, lessonId: string) =>
    request<{ lessons: ApiLesson[] }>(`/courses/${courseId}/lessons/${lessonId}`, { method: "DELETE" }),
  reorderLessons: (courseId: string, order: string[]) =>
    request<{ lessons: ApiLesson[] }>(`/courses/${courseId}/lessons/reorder`, { method: "PATCH", body: JSON.stringify({ order }) }),
};
