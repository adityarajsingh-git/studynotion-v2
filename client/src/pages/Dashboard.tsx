import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { RootState } from "../store/store";
import { api, ApiCourse } from "../lib/api";

/** A11y: the meaning lives in the label text ("Draft"/"Published") — colour
 * (muted vs amber) is only reinforcement. */
function StatusBadge({ status }: { status: ApiCourse["status"] }) {
  return status === "published" ? (
    <span className="rounded-md bg-amber px-2 py-0.5 text-xs font-semibold text-ink">Published</span>
  ) : (
    <span className="rounded-md border border-edge px-2 py-0.5 text-xs font-semibold text-muted">Draft</span>
  );
}

/** Instructor-only. The myCourses request fires on mount, so rendering this
 * component only for instructors is what keeps students from ever making
 * the call. */
function InstructorCourses() {
  const [courses, setCourses] = useState<ApiCourse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .myCourses()
      .then((data) => setCourses(data.courses))
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <>
      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-xl font-bold text-cream">Your courses</h2>
        <Link
          to="/instructor/courses/new"
          className="rounded-xl bg-amber px-4 py-2 text-sm font-semibold text-ink hover:bg-amber/90"
        >
          New course
        </Link>
      </div>

      {error ? (
        <p className="mt-3 text-red-400">Couldn't load your courses: {error}</p>
      ) : courses === null ? (
        <p className="mt-3">Loading your courses…</p>
      ) : courses.length === 0 ? (
        <p className="mt-3">
          No courses yet —{" "}
          <Link to="/instructor/courses/new" className="text-amber hover:underline">
            create your first one
          </Link>
          .
        </p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <div key={c._id} className="rounded-2xl border border-edge bg-panel p-5">
              <div className="mb-3 h-2 rounded-full" style={{ background: c.thumbnailColor }} />
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-cream">{c.title}</div>
                <StatusBadge status={c.status} />
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted">
                  {c.studentCount} {c.studentCount === 1 ? "student" : "students"} · ₹{c.price}
                </span>
                <Link to={`/instructor/courses/${c._id}/edit`} className="text-amber hover:underline">
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** The pre-Commit-11 student dashboard, unchanged. */
function EnrolledCourses({ enrolled }: { enrolled: { _id: string; title: string; price: number; thumbnailColor: string }[] }) {
  return (
    <>
      <h2 className="mt-10 text-xl font-bold text-cream">Your courses</h2>
      {enrolled.length === 0 ? (
        <p className="mt-3">Nothing yet — <Link to="/courses" className="text-amber hover:underline">browse the catalog</Link> and enroll. (Progress tracking lands in Week 2 — see ROADMAP.md.)</p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {enrolled.map((c) => (
            <Link key={c._id} to={`/courses/${c._id}`} className="rounded-2xl border border-edge bg-panel p-5 hover:border-amber">
              <div className="mb-3 h-2 rounded-full" style={{ background: c.thumbnailColor }} />
              <div className="font-semibold text-cream">{c.title}</div>
              <div className="mt-1 text-sm">₹{c.price}</div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export default function Dashboard() {
  const user = useSelector((s: RootState) => s.auth.user)!;

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="text-3xl font-bold text-cream">Hi, {user.name.split(" ")[0]} 👋</h1>
      <p className="mt-1 text-sm">Signed in as {user.email} · role: <span className="capitalize text-amber">{user.role}</span></p>

      {user.role === "instructor" ? (
        <InstructorCourses />
      ) : (
        <EnrolledCourses enrolled={user.enrolledCourses} />
      )}
    </main>
  );
}
