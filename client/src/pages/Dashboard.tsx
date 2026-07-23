import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { RootState } from "../store/store";

export default function Dashboard() {
  const user = useSelector((s: RootState) => s.auth.user)!;
  const enrolled = user.enrolledCourses ?? [];

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="text-3xl font-bold text-cream">Hi, {user.name.split(" ")[0]} 👋</h1>
      <p className="mt-1 text-sm">Signed in as {user.email} · role: <span className="capitalize text-amber">{user.role}</span></p>

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
    </main>
  );
}
