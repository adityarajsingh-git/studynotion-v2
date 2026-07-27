import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../store/store";
import { clearAuthError, login } from "../store/authSlice";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { status, error } = useSelector((s: RootState) => s.auth);
  const dispatch = useDispatch<AppDispatch>();
  const nav = useNavigate();

  // Drop any error left over from the signup form.
  useEffect(() => { dispatch(clearAuthError()); }, [dispatch]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await dispatch(login({ email, password }));
    if (login.fulfilled.match(res)) nav("/dashboard");
  }

  return (
    <main className="mx-auto max-w-md px-5 py-20">
      <h1 className="text-3xl font-bold text-cream">Welcome back</h1>
      <p className="mt-1 text-sm">Log in to continue learning.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="Email"
          className="w-full rounded-xl border border-edge bg-panel px-4 py-3 text-cream outline-none focus:border-amber" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required placeholder="Password"
          className="w-full rounded-xl border border-edge bg-panel px-4 py-3 text-cream outline-none focus:border-amber" />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={status === "loading"}
          className="w-full rounded-xl bg-amber py-3 font-semibold text-ink hover:bg-amber-dark disabled:opacity-60">
          {status === "loading" ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="mt-5 text-sm">New here? <Link to="/signup" className="text-amber hover:underline">Create an account</Link></p>
    </main>
  );
}
