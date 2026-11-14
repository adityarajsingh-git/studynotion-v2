import { useEffect, useState } from "react";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { Link, useParams } from "react-router-dom";
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
  const [attempt, setAttempt] = useState(0);
  useDocumentTitle(course?.title ?? "Course");

  useEffect(() => {
    if (id) api.course(id).then((d) => setCourse(d.course)).catch((e) => setMsg(e.message));
  }, [id, attempt]);

  if (!course) {
    if (!msg) return <main className="mx-auto max-w-4xl px-5 py-16">Loading…</main>;
    return (
      <main className="mx-auto max-w-4xl px-5 py-16">
        <div role="alert" className="rounded-xl border border-edge bg-panel p-6">
          <p className="text-amber">{msg}</p>
          <div className="mt-4 flex items-center gap-4">
            <button onClick={() => { setMsg(""); setAttempt((n) => n + 1); }}
              className="rounded-xl bg-amber px-4 py-2 text-sm font-semibold text-ink hover:bg-amber-dark">
              Retry
            </button>
            <Link to="/courses" className="text-sm text-cream hover:text-amber">← Back to catalog</Link>
          </div>
        </div>
      </main>
    );
  }

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

  const enrolled = !!user?.enrolledCourses.some((c) => c._id === course._id);
  const mins = totalMinutes(course.lessons);

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <span className="rounded-md px-2 py-1 text-xs font-semibold text-ink" style={{ background: course.thumbnailColor }}>
        {course.category?.name}
      </span>
      <h1 className="mt-4 text-3xl font-bold text-cream">{course.title}</h1>
      <p className="mt-1 text-sm">by {course.instructor?.name} · {course.lessons.length} lessons · {formatDuration(mins)} · {course.studentCount} enrolled</p>
      <p className="mt-6 max-w-2xl">{course.description}</p>

      <div className="mt-8 flex items-center gap-5">
        <span className="text-2xl font-bold text-cream">₹{course.price}</span>
        {enrolled
          ? <>
              <span className="font-semibold text-amber">✓ You're enrolled</span>
              <Link to="/dashboard" className="rounded-xl border border-edge px-6 py-2.5 font-semibold text-cream hover:border-amber">
                Go to dashboard
              </Link>
            </>
          : user
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
