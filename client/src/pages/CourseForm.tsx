import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiLesson } from "../lib/api";
import LessonEditor from "../components/LessonEditor";

/** Preset thumbnail swatches — same palette family as the seeded courses. */
export const SWATCHES = ["#d9a54f", "#69b578", "#5d8aa8", "#c76b6b", "#9b7cc3"];

const inputCls =
  "w-full rounded-xl border border-edge bg-panel px-4 py-3 text-cream outline-none focus:border-amber";
const labelCls = "mb-1 block text-sm text-cream";

const emptyForm = {
  title: "", description: "", category: "", price: "", thumbnailColor: SWATCHES[0],
};
type FormValues = typeof emptyForm;

/**
 * One component, two routes:
 *   /instructor/courses/new       → create mode (no :id)
 *   /instructor/courses/:id/edit  → edit mode (prefill + publish/delete)
 */
export default function CourseForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const nav = useNavigate();

  const [form, setForm] = useState<FormValues>(emptyForm);
  // The last server-confirmed values — what "no unsaved edits" means.
  const [loaded, setLoaded] = useState<FormValues>(emptyForm);
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([]);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  // Lessons load once with the course; LessonEditor owns them from there on.
  const [initialLessons, setInitialLessons] = useState<ApiLesson[]>([]);
  const [loading, setLoading] = useState(editing);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  // Shared in-flight guard for publish/delete so a double-click can't fire twice.
  const [mutating, setMutating] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Publish sends only { status }, so any pending field edits would be lost —
  // dirty gates the publish button until the user saves.
  const dirty =
    editing &&
    (Object.keys(emptyForm) as (keyof FormValues)[]).some((k) => form[k] !== loaded[k]);

  // The dropdown loads from the server so it always matches the ids the
  // create/update endpoints will actually accept.
  useEffect(() => {
    api.categories()
      .then((r) => setCategories(r.categories))
      .catch((e) => setError((e as Error).message));
  }, []);

  // Edit mode: prefill from the server. The owner may fetch their own draft —
  // GET /courses/:id already allows that server-side.
  useEffect(() => {
    if (!id) return;
    let on = true;
    setLoading(true);
    api.course(id)
      .then(({ course }) => {
        if (!on) return;
        const values: FormValues = {
          title: course.title,
          description: course.description,
          category: course.category?._id ?? "",
          price: String(course.price),
          thumbnailColor: course.thumbnailColor,
        };
        setForm(values);
        setLoaded(values);
        setStatus(course.status);
        setInitialLessons(course.lessons);
      })
      .catch((e) => {
        if (!on) return;
        // 403/404 (someone else's course, bad id): showing an editable empty
        // form here would be a trap — render the error screen instead.
        setError((e as Error).message);
        setLoadFailed(true);
      })
      .finally(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [id]);

  const set = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setNotice("");
    // The form is noValidate, so this explicit check is what blocks the
    // submit — and it says why, instead of silently doing nothing.
    if (!form.title.trim() || !form.description.trim() || !form.category || form.price === "") {
      setError("Please fill in all required fields.");
      return;
    }
    const price = Number(form.price);
    if (Number.isNaN(price) || price < 0) {
      setError("Price must be a non-negative number.");
      return;
    }
    setError("");
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      price,
      thumbnailColor: form.thumbnailColor,
    };
    try {
      if (editing) {
        await api.updateCourse(id!, payload);
        // Sync both states to the normalized (trimmed) values the server now
        // holds — this clears `dirty` and re-enables Publish.
        const savedValues: FormValues = {
          ...form,
          title: payload.title,
          description: payload.description,
          price: String(payload.price),
        };
        setForm(savedValues);
        setLoaded(savedValues);
        setNotice("Saved.");
      } else {
        const { course } = await api.createCourse(payload);
        // Land on the edit page — adding lessons is the natural next step.
        nav(`/instructor/courses/${course._id}/edit`);
      }
    } catch (err) {
      // Surface the server's message verbatim ("Category not found", 403, 404…).
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus() {
    if (mutating) return; // ignore a second click while the first is in flight
    setError(""); setNotice("");
    setMutating(true);
    try {
      const next = status === "published" ? ("draft" as const) : ("published" as const);
      const { course } = await api.updateCourse(id!, { status: next });
      setStatus(course.status);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setMutating(false);
    }
  }

  async function onDelete() {
    if (mutating) return; // ignore a second click while the first is in flight
    setError(""); setNotice("");
    setMutating(true);
    try {
      await api.deleteCourse(id!);
      nav("/dashboard");
    } catch (err) {
      // e.g. the 409 "…enrolled students" guard — show the server's reason.
      setError((err as Error).message);
      setConfirmingDelete(false);
    } finally {
      setMutating(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-2xl px-5 py-16">Loading…</main>;

  // The course never arrived (403/404/network) — no editable form, just the
  // reason and a way out.
  if (loadFailed) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16">
        <p className="text-red-400">{error || "Couldn't load this course."}</p>
        <Link to="/dashboard" className="mt-4 inline-block text-amber hover:underline">
          Back to dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-3xl font-bold text-cream">{editing ? "Edit course" : "New course"}</h1>
      {editing && (
        <p className="mt-1 text-sm">
          Status: <span className={status === "published" ? "text-amber" : ""}>{status}</span>
        </p>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
        <div>
          <label htmlFor="cf-title" className={labelCls}>Title</label>
          <input id="cf-title" value={form.title} onChange={set("title")} required className={inputCls} />
        </div>
        <div>
          <label htmlFor="cf-description" className={labelCls}>Description</label>
          <textarea id="cf-description" value={form.description} onChange={set("description")} required rows={5} className={inputCls} />
        </div>
        <div>
          <label htmlFor="cf-category" className={labelCls}>Category</label>
          <select id="cf-category" value={form.category} onChange={set("category")} required className={inputCls}>
            <option value="">Select a category</option>
            {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cf-price" className={labelCls}>Price (₹)</label>
          <input id="cf-price" value={form.price} onChange={set("price")} type="number" min={0} required className={inputCls} />
        </div>
        <div>
          <span id="cf-swatches" className={labelCls}>Thumbnail color</span>
          <div role="group" aria-labelledby="cf-swatches" className="flex gap-2">
            {SWATCHES.map((c) => (
              <button type="button" key={c} aria-label={`Use color ${c}`}
                aria-pressed={form.thumbnailColor === c}
                onClick={() => setForm((f) => ({ ...f, thumbnailColor: c }))}
                className={`h-8 w-8 rounded-full border-2 ${form.thumbnailColor === c ? "border-amber" : "border-edge"}`}
                style={{ background: c }} />
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {notice && <p className="text-sm text-amber">{notice}</p>}

        <button disabled={saving}
          className="w-full rounded-xl bg-amber py-3 font-semibold text-ink hover:bg-amber-dark disabled:opacity-60">
          {saving ? "Saving…" : editing ? "Save changes" : "Create course"}
        </button>
      </form>

      {/* Create mode has no course id yet — nothing to attach lessons to.
          key={id} forces a remount when navigating between edit pages, so a
          stale lesson list can never survive a course switch. */}
      {editing && <LessonEditor key={id} courseId={id!} initialLessons={initialLessons} />}

      {editing && (
        <section className="mt-10 space-y-3 rounded-2xl border border-edge bg-panel p-5">
          <h2 className="text-lg font-bold text-cream">Publishing</h2>
          <p className="text-sm">
            {status === "published"
              ? "Students can see this course in the catalog."
              : "Drafts are only visible to you."}
          </p>
          {dirty && (
            <p className="text-sm text-red-400">You have unsaved changes. Save them first.</p>
          )}
          <button onClick={toggleStatus} disabled={dirty || mutating}
            className="rounded-xl border border-amber px-5 py-2 text-amber hover:bg-amber hover:text-ink disabled:pointer-events-none disabled:opacity-60">
            {status === "published" ? "Unpublish" : "Publish"}
          </button>

          <h2 className="pt-4 text-lg font-bold text-cream">Danger zone</h2>
          {confirmingDelete ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm">This permanently deletes the course.</span>
              <button onClick={onDelete} disabled={mutating}
                className="rounded-xl bg-red-500 px-4 py-2 font-semibold text-ink hover:bg-red-400 disabled:opacity-60">
                Yes, delete
              </button>
              <button onClick={() => setConfirmingDelete(false)}
                className="rounded-xl border border-edge px-4 py-2 hover:text-cream">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmingDelete(true)}
              className="rounded-xl border border-red-400 px-5 py-2 text-red-400 hover:bg-red-400 hover:text-ink">
              Delete course
            </button>
          )}
        </section>
      )}
    </main>
  );
}
