import { FormEvent, useState } from "react";
import { api, ApiLesson } from "../lib/api";
import { formatDuration, totalMinutes } from "../lib/format";

// Mirrors CourseForm's field styling. Kept local — importing from the page
// would create an import cycle.
const inputCls =
  "w-full rounded-xl border border-edge bg-panel px-4 py-3 text-cream outline-none focus:border-amber";
const labelCls = "mb-1 block text-sm text-cream";

/**
 * Client-side mirror of the server's lesson rules: title required (max 200),
 * durationMin a non-negative integer, empty duration → 0.
 */
function validate(
  titleRaw: string,
  durationRaw: string
): { error: string } | { error: null; title: string; durationMin: number } {
  const title = titleRaw.trim();
  if (!title) return { error: "Lesson title is required." };
  if (title.length > 200) return { error: "Lesson title must be 200 characters or fewer." };
  // Empty means "not timed yet" — the server defaults it to 0 the same way.
  const durationMin = durationRaw.trim() === "" ? 0 : Number(durationRaw);
  if (!Number.isInteger(durationMin) || durationMin < 0)
    return { error: "Duration must be a non-negative whole number of minutes." };
  return { error: null, title, durationMin };
}

/**
 * Edit-mode-only lesson manager. The list is an <ol> because order is part
 * of the data. Reordering uses ↑/↓ buttons instead of drag-and-drop: no
 * extra library, and it stays keyboard- and screen-reader-accessible.
 */
export default function LessonEditor({
  courseId,
  initialLessons,
}: {
  courseId: string;
  initialLessons: ApiLesson[];
}) {
  // The prop is adopted once, on mount — after that the server's responses
  // own this state. A course switch must remount the component; CourseForm
  // guarantees that with key={courseId} on this element.
  const [lessons, setLessons] = useState<ApiLesson[]>(initialLessons);
  const [newTitle, setNewTitle] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  // One in-flight guard for every mutation — a double-click can't queue two
  // requests, and the arrows can't race the server's order.
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState("");

  async function run(op: () => Promise<void>) {
    if (mutating) return;
    setError("");
    setMutating(true);
    try {
      await op();
    } catch (err) {
      // Surface the server's message verbatim (403/404/validation).
      setError((err as Error).message);
    } finally {
      setMutating(false);
    }
  }

  function onAdd(e: FormEvent) {
    e.preventDefault();
    const v = validate(newTitle, newDuration);
    if (v.error !== null) return setError(v.error);
    void run(async () => {
      // The server returns the created lesson (with its _id) — append that,
      // never a locally-guessed one.
      const { lesson } = await api.addLesson(courseId, { title: v.title, durationMin: v.durationMin });
      setLessons((ls) => [...ls, lesson]);
      setNewTitle("");
      setNewDuration("");
    });
  }

  function startEdit(l: ApiLesson) {
    setEditingId(l._id);
    setEditTitle(l.title);
    setEditDuration(String(l.durationMin));
    setError("");
  }

  function onSaveEdit() {
    const v = validate(editTitle, editDuration);
    if (v.error !== null) return setError(v.error);
    void run(async () => {
      const { lesson } = await api.updateLesson(courseId, editingId!, {
        title: v.title,
        durationMin: v.durationMin,
      });
      setLessons((ls) => ls.map((l) => (l._id === lesson._id ? lesson : l)));
      setEditingId(null);
    });
  }

  function onDelete(id: string) {
    void run(async () => {
      // Delete returns the full remaining array — adopt it wholesale.
      const { lessons: next } = await api.deleteLesson(courseId, id);
      setLessons(next);
      setConfirmingId(null);
    });
  }

  function move(index: number, delta: -1 | 1) {
    const next = [...lessons];
    const [moved] = next.splice(index, 1);
    next.splice(index + delta, 0, moved);
    void run(async () => {
      // Send the whole id array; render whatever order the server confirms.
      const { lessons: confirmed } = await api.reorderLessons(courseId, next.map((l) => l._id));
      setLessons(confirmed);
    });
  }

  return (
    <section className="mt-10 space-y-4 rounded-2xl border border-edge bg-panel p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-cream">Lessons</h2>
        <span className="text-sm text-muted">
          {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"} · {formatDuration(totalMinutes(lessons))}
        </span>
      </div>

      {lessons.length === 0 ? (
        <p className="text-sm">No lessons yet — add the first one below.</p>
      ) : (
        <ol className="space-y-2">
          {lessons.map((l, i) => (
            <li key={l._id} className="rounded-xl border border-edge px-4 py-3">
              {editingId === l._id ? (
                <div className="space-y-2">
                  <div>
                    <label htmlFor={`le-title-${l._id}`} className={labelCls}>Lesson title</label>
                    <input id={`le-title-${l._id}`} value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label htmlFor={`le-duration-${l._id}`} className={labelCls}>Duration (min)</label>
                    <input id={`le-duration-${l._id}`} value={editDuration}
                      onChange={(e) => setEditDuration(e.target.value)} type="number" min={0} className={inputCls} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={onSaveEdit} disabled={mutating}
                      className="rounded-xl bg-amber px-4 py-2 text-sm font-semibold text-ink hover:bg-amber-dark disabled:opacity-60">
                      Save
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="rounded-xl border border-edge px-4 py-2 text-sm hover:text-cream">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted">{i + 1}.</span>
                  <span className="flex-1 font-medium text-cream">{l.title}</span>
                  <span className="text-sm text-muted">{formatDuration(l.durationMin)}</span>
                  <button onClick={() => move(i, -1)} disabled={i === 0 || mutating}
                    aria-label={`Move ${l.title} up`}
                    className="rounded-lg border border-edge px-2 py-1 text-sm hover:text-cream disabled:opacity-40">
                    ↑
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === lessons.length - 1 || mutating}
                    aria-label={`Move ${l.title} down`}
                    className="rounded-lg border border-edge px-2 py-1 text-sm hover:text-cream disabled:opacity-40">
                    ↓
                  </button>
                  <button onClick={() => startEdit(l)} aria-label={`Edit ${l.title}`}
                    className="text-sm text-amber hover:underline">
                    Edit
                  </button>
                  {confirmingId === l._id ? (
                    <span className="flex items-center gap-2">
                      <button onClick={() => onDelete(l._id)} disabled={mutating}
                        aria-label={`Confirm delete ${l.title}`}
                        className="rounded-lg bg-red-500 px-2 py-1 text-sm font-semibold text-ink hover:bg-red-400 disabled:opacity-60">
                        Yes, delete
                      </button>
                      <button onClick={() => setConfirmingId(null)}
                        className="rounded-lg border border-edge px-2 py-1 text-sm hover:text-cream">
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmingId(l._id)} aria-label={`Delete ${l.title}`}
                      className="text-sm text-red-400 hover:underline">
                      Delete
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <form onSubmit={onAdd} noValidate className="space-y-3 border-t border-edge pt-4">
        <div>
          <label htmlFor="le-new-title" className={labelCls}>Lesson title</label>
          <input id="le-new-title" value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="le-new-duration" className={labelCls}>Duration (min)</label>
          <input id="le-new-duration" value={newDuration}
            onChange={(e) => setNewDuration(e.target.value)} type="number" min={0} className={inputCls} />
        </div>
        <button disabled={mutating}
          className="rounded-xl bg-amber px-5 py-2 font-semibold text-ink hover:bg-amber-dark disabled:opacity-60">
          Add lesson
        </button>
      </form>
    </section>
  );
}
