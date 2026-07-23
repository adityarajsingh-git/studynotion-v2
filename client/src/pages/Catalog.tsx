import { useEffect, useState } from "react";
import { api, ApiCourse } from "../lib/api";
import CourseCard from "../components/CourseCard";

export default function Catalog() {
  const [courses, setCourses] = useState<ApiCourse[]>([]);
  const [cats, setCats] = useState<{ _id: string; name: string }[]>([]);
  const [cat, setCat] = useState("");
  const [search, setSearch] = useState("");
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [err, setErr] = useState("");

  useEffect(() => { api.categories().then((d) => setCats(d.categories)).catch(() => {}); }, []);

  useEffect(() => {
    setState("loading");
    const q = new URLSearchParams();
    if (cat) q.set("category", cat);
    if (search) q.set("search", search);
    api.courses(q.toString() ? `?${q}` : "")
      .then((d) => { setCourses(d.courses); setState("ok"); })
      .catch((e) => { setErr(e.message); setState("error"); });
  }, [cat, search]);

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="text-3xl font-bold text-cream">Catalog</h1>
      <div className="mt-6 flex flex-wrap gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search courses…"
          className="w-64 rounded-xl border border-edge bg-panel px-4 py-2.5 text-cream outline-none focus:border-amber" />
        <select value={cat} onChange={(e) => setCat(e.target.value)}
          className="rounded-xl border border-edge bg-panel px-4 py-2.5 text-cream outline-none focus:border-amber">
          <option value="">All categories</option>
          {cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
      </div>

      {state === "loading" && <p className="mt-10">Loading courses…</p>}
      {state === "error" && (
        <div className="mt-10 rounded-xl border border-edge bg-panel p-6 text-sm">
          <p className="text-red-400">Couldn't load courses: {err}</p>
          <p className="mt-2">Is the API running and seeded? <code className="text-amber">cd server && npm run dev</code> then <code className="text-amber">npm run seed</code>.</p>
        </div>
      )}
      {state === "ok" && (
        courses.length === 0
          ? <p className="mt-10">No courses match. Run <code className="text-amber">npm run seed</code> in <code>server/</code> for demo data.</p>
          : <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c) => <CourseCard key={c._id} course={c} />)}
            </div>
      )}
    </main>
  );
}
