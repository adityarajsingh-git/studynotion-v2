const BASE = "/api/v2";

export interface EnrolledCourse { _id: string; title: string; price: number; thumbnailColor: string }

export interface ApiUser {
  id: string; name: string; email: string; role: "student" | "instructor";
  /** Always present — signup, login and /me all return the same user shape. */
  enrolledCourses: EnrolledCourse[];
}
export interface ApiCourse {
  _id: string; title: string; description: string; price: number; thumbnailColor: string;
  instructor?: { name: string }; category?: { name: string };
  lessons: { title: string; durationMin: number }[]; students: string[];
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
};
