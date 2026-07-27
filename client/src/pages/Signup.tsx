import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../store/store";
import { clearAuthError, signup } from "../store/authSlice";

export default function Signup() {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "student" });
  const { status, error } = useSelector((s: RootState) => s.auth);
  const dispatch = useDispatch<AppDispatch>();
  const nav = useNavigate();

  // Drop any error left over from the login form.
  useEffect(() => { dispatch(clearAuthError()); }, [dispatch]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await dispatch(signup(form));
    if (signup.fulfilled.match(res)) nav("/dashboard");
  }

  return (
    <main className="mx-auto max-w-md px-5 py-20">
      <h1 className="text-3xl font-bold text-cream">Create your account</h1>
      <p className="mt-1 text-sm">Join as a student, or teach as an instructor.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <input value={form.name} onChange={set("name")} required placeholder="Full name"
          className="w-full rounded-xl border border-edge bg-panel px-4 py-3 text-cream outline-none focus:border-amber" />
        <input value={form.email} onChange={set("email")} type="email" required placeholder="Email"
          className="w-full rounded-xl border border-edge bg-panel px-4 py-3 text-cream outline-none focus:border-amber" />
        <input value={form.password} onChange={set("password")} type="password" required minLength={6} placeholder="Password (min 6 chars)"
          className="w-full rounded-xl border border-edge bg-panel px-4 py-3 text-cream outline-none focus:border-amber" />
        <div className="flex gap-3">
          {(["student", "instructor"] as const).map((r) => (
            <button type="button" key={r} onClick={() => setForm((f) => ({ ...f, role: r }))}
              className={`flex-1 rounded-xl border px-4 py-2.5 capitalize ${form.role === r ? "border-amber text-amber" : "border-edge hover:text-cream"}`}>
              {r}
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={status === "loading"}
          className="w-full rounded-xl bg-amber py-3 font-semibold text-ink hover:bg-amber-dark disabled:opacity-60">
          {status === "loading" ? "Creating…" : "Sign up"}
        </button>
      </form>
      <p className="mt-5 text-sm">Already have an account? <Link to="/login" className="text-amber hover:underline">Log in</Link></p>
    </main>
  );
}
