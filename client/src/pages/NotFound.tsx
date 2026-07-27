import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-5 py-24 text-center">
      <p className="text-6xl font-extrabold text-amber">404</p>
      <h1 className="mt-4 text-3xl font-bold text-cream">Page not found</h1>
      <p className="mt-3">That URL doesn't exist — it may have moved, or never shipped.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link to="/" className="rounded-xl bg-amber px-6 py-2.5 font-semibold text-ink hover:bg-amber-dark">
          Back home
        </Link>
        <Link to="/courses" className="rounded-xl border border-edge px-6 py-2.5 font-semibold text-cream hover:border-amber">
          Browse catalog
        </Link>
      </div>
    </main>
  );
}
