import { Link } from "react-router-dom";

const PILLARS = [
  { t: "Learn", d: "Structured courses with lesson-by-lesson progress — search and filter to find what fits." },
  { t: "Build", d: "Instructor tools to create courses, sections and lessons — the course builder lands in Week 2." },
  { t: "Ship", d: "Razorpay-powered enrollment and a live deployment are on the roadmap. Watch this repo grow." },
];

export default function Landing() {
  return (
    <main>
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-20 text-center">
        <span className="rounded-full border border-edge bg-panel px-4 py-1.5 text-xs tracking-wide">
          v2 · ground-up rebuild · in active development
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-tight text-cream sm:text-6xl">
          Learn. Build. <span className="text-amber">Ship.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg">
          An ed-tech platform rebuilt from an empty folder — React, TypeScript, Express and MongoDB, wired together properly this time.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-4">
          <Link to="/courses" className="rounded-xl bg-amber px-7 py-3 font-semibold text-ink hover:bg-amber-dark">
            Browse courses
          </Link>
          <a href="https://github.com/adityarajsingh-git/studynotion-v2" target="_blank" rel="noreferrer"
             className="rounded-xl border border-edge px-7 py-3 font-semibold text-cream hover:border-amber">
            Star the rebuild ↗
          </a>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-5 px-5 pb-24 sm:grid-cols-3">
        {PILLARS.map((p) => (
          <div key={p.t} className="rounded-2xl border border-edge bg-panel p-6">
            <h3 className="mb-2 text-lg font-bold text-amber">{p.t}</h3>
            <p className="text-sm">{p.d}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
