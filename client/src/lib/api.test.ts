import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, setToken } from "./api";

/** Minimal Response stand-ins — request() only touches ok/status/json(). */
const ok = (data: unknown) =>
  ({ ok: true, status: 200, json: async () => data }) as unknown as Response;
const fail = (status: number, message: string) =>
  ({ ok: false, status, json: async () => ({ success: false, message }) }) as unknown as Response;

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(ok({ success: true }));
  vi.stubGlobal("fetch", fetchMock);
  // The builder endpoints are all authenticated — seed a token the way the
  // real app does, so request() picks it up from localStorage.
  setToken("t0k3n");
});

afterEach(() => {
  vi.unstubAllGlobals();
  setToken(null);
});

/** The single fetch call's [url, init], typed for assertions. */
function lastCall() {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string> };
}

describe("course builder API layer", () => {
  // Dashboard list: a plain GET (fetch's default when no method is set)
  // against the instructor-only /courses/mine route.
  it("myCourses hits GET /api/v2/courses/mine", async () => {
    await api.myCourses();
    const { url, init } = lastCall();
    expect(url).toBe("/api/v2/courses/mine");
    expect(init.method).toBeUndefined();
  });

  // Create: POST /courses with the whole payload serialized as the JSON body.
  it("createCourse POSTs the payload to /api/v2/courses", async () => {
    const payload = { title: "T", description: "D", category: "cat1", price: 499 };
    await api.createCourse(payload);
    const { url, init } = lastCall();
    expect(url).toBe("/api/v2/courses");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(payload);
  });

  // Update: PATCH /courses/:id, and the body carries ONLY the patched fields —
  // the server's whitelist expects a sparse patch, not a full course.
  it("updateCourse PATCHes only the given fields", async () => {
    await api.updateCourse("c1", { status: "published" });
    const { url, init } = lastCall();
    expect(url).toBe("/api/v2/courses/c1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ status: "published" });
  });

  // Delete: DELETE /courses/:id with no body at all.
  it("deleteCourse DELETEs /api/v2/courses/:id", async () => {
    await api.deleteCourse("c1");
    const { url, init } = lastCall();
    expect(url).toBe("/api/v2/courses/c1");
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
  });

  // Lesson add: POST under the course's /lessons collection with the lesson body.
  it("addLesson POSTs to /api/v2/courses/:id/lessons", async () => {
    await api.addLesson("c1", { title: "Intro", durationMin: 5 });
    const { url, init } = lastCall();
    expect(url).toBe("/api/v2/courses/c1/lessons");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ title: "Intro", durationMin: 5 });
  });

  // Lesson edit: PATCH targets the specific lessonId in the URL, sparse body.
  it("updateLesson PATCHes /api/v2/courses/:id/lessons/:lessonId", async () => {
    await api.updateLesson("c1", "l1", { title: "Renamed" });
    const { url, init } = lastCall();
    expect(url).toBe("/api/v2/courses/c1/lessons/l1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ title: "Renamed" });
  });

  // Lesson delete: DELETE the specific lessonId under the course.
  it("deleteLesson DELETEs /api/v2/courses/:id/lessons/:lessonId", async () => {
    await api.deleteLesson("c1", "l1");
    const { url, init } = lastCall();
    expect(url).toBe("/api/v2/courses/c1/lessons/l1");
    expect(init.method).toBe("DELETE");
  });

  // Reorder: PATCH /lessons/reorder wrapping the ids as { order } — the exact
  // body shape the server's permutation check reads.
  it("reorderLessons PATCHes { order } to /lessons/reorder", async () => {
    await api.reorderLessons("c1", ["l2", "l1"]);
    const { url, init } = lastCall();
    expect(url).toBe("/api/v2/courses/c1/lessons/reorder");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ order: ["l2", "l1"] });
  });

  // Auth rides on the shared request() helper: the stored token must go out
  // as a Bearer header — no bespoke auth mechanism in the new functions.
  it("sends the Bearer token in the Authorization header", async () => {
    await api.myCourses();
    const { headers } = lastCall();
    expect(headers.Authorization).toBe("Bearer t0k3n");
  });

  // Error contract, same as the existing functions: a 400 body's message
  // surfaces as the thrown Error message.
  it("throws the server message on 400", async () => {
    fetchMock.mockResolvedValue(fail(400, "Category not found"));
    await expect(
      api.createCourse({ title: "T", description: "D", category: "x", price: 1 })
    ).rejects.toThrow("Category not found");
  });

  // 403 (ownership denial on a published course) throws the same way.
  it("throws the server message on 403", async () => {
    fetchMock.mockResolvedValue(fail(403, "You do not own this course"));
    await expect(api.updateCourse("c1", { title: "X" })).rejects.toThrow(
      "You do not own this course"
    );
  });

  // 404 (nonexistent lesson) also rejects with the server's message.
  it("throws the server message on 404", async () => {
    fetchMock.mockResolvedValue(fail(404, "Lesson not found"));
    await expect(api.deleteLesson("c1", "nope")).rejects.toThrow("Lesson not found");
  });
});
