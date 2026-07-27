import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { api, ApiCourse } from "../lib/api";
import { formatDuration, totalMinutes } from "../lib/format";
import { AppDispatch, RootState } from "../store/store";
import { refreshUser } from "../store/authSlice";

export default function CourseDetails() {
  const { id } = useParams();
  const user = useSelector((s: RootState) => s.auth.user);
  const dispatch = useDispatch<AppDispatch>();
  const [course, setCourse] = useState<ApiCourse | null>(null);
  const [msg, setMsg] = useState("");
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => { if (id) api.course(id).then((d) => setCourse(d.course)).catch((e) => setMsg(e.message)); }, [id]);

  if (!course) return <main className="mx-auto max-w-4xl px-5 py-16">{msg || "Loading…"}</main>;

  async function onEnroll() {
    setEnrolling(true);
    try {
      const r = await api.enroll(course!._id);
      setMsg(r.message);
      // Pull the session again so the dashboard sees the new enrollment
      // without needing a page reload.
      await dispatch(refreshUser());
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setEnrolling(false);
    }
  }

  const mins = totalMinutes(course.lessons);

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <span className="rounded-md px-2 py-1 text-xs font-semibold text-ink" style={{ background: course.thumbnailColor }}>
        {course.category?.name}
      </span>
      <h1 className="mt-4 text-3xl font-bold text-cream">{course.title}</h1>
      <p className="mt-1 text-sm">by {course.instructor?.name} · {course.lessons.length} lessons · {formatDuration(mins)} · {course.students.length} enrolled</p>
      <p className="mt-6 max-w-2xl">{course.description}</p>

      <div className="mt-8 flex items-center gap-5">
        <span className="text-2xl font-bold text-cream">₹{course.price}</span>
        {user
          ? <button onClick={onEnroll} disabled={enrolling}
              className="rounded-xl bg-amber px-6 py-2.5 font-semibold text-ink hover:bg-amber-dark disabled:opacity-60">
              {enrolling ? "Enrolling…" : "Enroll"}
            </button>
          : <span className="text-sm">Log in to enroll.</span>}
      </div>
      {msg && <p className="mt-4 text-sm text-amber">{msg}</p>}

      <h2 className="mt-12 text-xl font-bold text-cream">What's inside</h2>
      <ul className="mt-4 space-y-2">
        {course.lessons.map((l, i) => (
          <li key={i} className="flex justify-between rounded-xl border border-edge bg-panel px-4 py-3 text-sm">
            <span className="text-cream">{i + 1}. {l.title}</span>
            <span>{l.durationMin} min</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
