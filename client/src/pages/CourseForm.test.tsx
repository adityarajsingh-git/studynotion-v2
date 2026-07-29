import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { api } from "../lib/api";
import CourseForm from "./CourseForm";
import { aCourse, renderWithProviders } from "../test/utils";

const CATEGORIES = [
  { _id: "cat1", name: "Web Development" },
  { _id: "cat2", name: "Data & Databases" },
];

/** Mounts the real routes around the form so navigation can be asserted. */
function renderForm(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/dashboard" element={<p>dashboard page</p>} />
      <Route path="/instructor/courses/new" element={<CourseForm />} />
      <Route path="/instructor/courses/:id/edit" element={<CourseForm />} />
    </Routes>,
    { route }
  );
}

/** Fills the three text fields and picks a category — a valid create form. */
async function fillValidForm() {
  await userEvent.type(screen.getByLabelText("Title"), "React 101");
  await userEvent.type(screen.getByLabelText("Description"), "Ship it");
  await screen.findByRole("option", { name: "Web Development" });
  await userEvent.selectOptions(screen.getByLabelText("Category"), "cat1");
  await userEvent.type(screen.getByLabelText(/Price/), "499");
}

describe("CourseForm — create mode", () => {
  // The bare route renders the empty form with the server-fed category list.
  it("renders and populates the category dropdown", async () => {
    vi.spyOn(api, "categories").mockResolvedValue({ categories: CATEGORIES });

    renderForm("/instructor/courses/new");

    expect(screen.getByRole("heading", { name: "New course" })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "Web Development" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Data & Databases" })).toBeInTheDocument();
  });

  // Submitting the empty form must not reach the API — the form explains
  // what's missing instead.
  it("blocks submit when required fields are empty", async () => {
    vi.spyOn(api, "categories").mockResolvedValue({ categories: CATEGORIES });
    const spy = vi.spyOn(api, "createCourse");

    renderForm("/instructor/courses/new");
    await userEvent.click(screen.getByRole("button", { name: "Create course" }));

    expect(await screen.findByText(/fill in all required fields/i)).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  // A valid submit sends exactly the payload the server's whitelist expects,
  // with price as a number and the selected swatch.
  it("calls api.createCourse with the typed payload", async () => {
    vi.spyOn(api, "categories").mockResolvedValue({ categories: CATEGORIES });
    vi.spyOn(api, "course").mockResolvedValue({ course: aCourse({ _id: "c9", status: "draft" }) });
    const spy = vi.spyOn(api, "createCourse")
      .mockResolvedValue({ course: aCourse({ _id: "c9", status: "draft" }) });

    renderForm("/instructor/courses/new");
    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Create course" }));

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({
        title: "React 101",
        description: "Ship it",
        category: "cat1",
        price: 499,
        thumbnailColor: "#d9a54f",
      })
    );
  });

  // After create we land on the new course's edit page — lessons come next.
  it("navigates to the edit page after a successful create", async () => {
    vi.spyOn(api, "categories").mockResolvedValue({ categories: CATEGORIES });
    vi.spyOn(api, "course").mockResolvedValue({ course: aCourse({ _id: "c9", status: "draft" }) });
    vi.spyOn(api, "createCourse").mockResolvedValue({ course: aCourse({ _id: "c9", status: "draft" }) });

    renderForm("/instructor/courses/new");
    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Create course" }));

    expect(await screen.findByRole("heading", { name: "Edit course" })).toBeInTheDocument();
  });

  // Whatever specific reason the server gives (here the category guard) must
  // reach the screen — no generic "Something went wrong".
  it("surfaces the server's error message on the screen", async () => {
    vi.spyOn(api, "categories").mockResolvedValue({ categories: CATEGORIES });
    vi.spyOn(api, "createCourse").mockRejectedValue(new Error("Category not found"));

    renderForm("/instructor/courses/new");
    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Create course" }));

    expect(await screen.findByText("Category not found")).toBeInTheDocument();
  });
});

describe("CourseForm — edit mode", () => {
  // The edit route loads the course and prefills every field, including the
  // category preselection by its _id.
  it("prefills the form from the fetched course", async () => {
    vi.spyOn(api, "categories").mockResolvedValue({ categories: CATEGORIES });
    vi.spyOn(api, "course").mockResolvedValue({ course: aCourse() });

    renderForm("/instructor/courses/c1/edit");

    expect(await screen.findByDisplayValue("React from Zero")).toBeInTheDocument();
    expect(screen.getByDisplayValue("A hands-on course")).toBeInTheDocument();
    expect(screen.getByDisplayValue("499")).toBeInTheDocument();
    await waitFor(() =>
      expect((screen.getByLabelText("Category") as HTMLSelectElement).value).toBe("cat1")
    );
  });

  // The publish toggle PATCHes only { status } — and flips the button once
  // the server confirms.
  it("publish toggle calls api.updateCourse with { status }", async () => {
    vi.spyOn(api, "categories").mockResolvedValue({ categories: CATEGORIES });
    vi.spyOn(api, "course").mockResolvedValue({ course: aCourse({ status: "draft" }) });
    const spy = vi.spyOn(api, "updateCourse")
      .mockResolvedValue({ course: aCourse({ status: "published" }) });

    renderForm("/instructor/courses/c1/edit");
    await userEvent.click(await screen.findByRole("button", { name: "Publish" }));

    expect(spy).toHaveBeenCalledWith("c1", { status: "published" });
    expect(await screen.findByRole("button", { name: "Unpublish" })).toBeInTheDocument();
  });

  // Delete is two-step: the API is only hit after the inline confirm, and a
  // success leaves the page for /dashboard.
  it("deletes after confirmation and navigates to the dashboard", async () => {
    vi.spyOn(api, "categories").mockResolvedValue({ categories: CATEGORIES });
    vi.spyOn(api, "course").mockResolvedValue({ course: aCourse() });
    const spy = vi.spyOn(api, "deleteCourse").mockResolvedValue({ message: "Course deleted" });

    renderForm("/instructor/courses/c1/edit");
    await userEvent.click(await screen.findByRole("button", { name: "Delete course" }));
    expect(spy).not.toHaveBeenCalled(); // first click only opens the confirm
    await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    expect(spy).toHaveBeenCalledWith("c1");
    expect(await screen.findByText("dashboard page")).toBeInTheDocument();
  });

  // Publish only PATCHes { status }, so pending field edits would be silently
  // lost — with a dirty form the button must be disabled and say why.
  it("disables Publish and warns while the form has unsaved edits", async () => {
    vi.spyOn(api, "categories").mockResolvedValue({ categories: CATEGORIES });
    vi.spyOn(api, "course").mockResolvedValue({ course: aCourse({ status: "draft" }) });

    renderForm("/instructor/courses/c1/edit");
    await screen.findByDisplayValue("React from Zero");
    await userEvent.type(screen.getByLabelText("Title"), "!");

    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
  });

  // Saving syncs the baseline to the new values, so the dirty flag clears and
  // Publish becomes clickable again.
  it("re-enables Publish after the edits are saved", async () => {
    vi.spyOn(api, "categories").mockResolvedValue({ categories: CATEGORIES });
    vi.spyOn(api, "course").mockResolvedValue({ course: aCourse({ status: "draft" }) });
    vi.spyOn(api, "updateCourse").mockResolvedValue({ course: aCourse({ status: "draft" }) });

    renderForm("/instructor/courses/c1/edit");
    await screen.findByDisplayValue("React from Zero");
    await userEvent.type(screen.getByLabelText("Title"), "!");
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled()
    );
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument();
  });

  // A failed load (404/403 — bad id or someone else's course) must not leave
  // an editable empty form behind: only the reason plus a way back.
  it("renders no form when the course fails to load", async () => {
    vi.spyOn(api, "categories").mockResolvedValue({ categories: CATEGORIES });
    vi.spyOn(api, "course").mockRejectedValue(new Error("Course not found"));

    renderForm("/instructor/courses/nope/edit");

    expect(await screen.findByText("Course not found")).toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to dashboard/i })).toBeInTheDocument();
  });

  // The 409 enrolled-students guard: the server's reason shows up and the
  // instructor stays on the page.
  it("shows the server's 409 message when delete is refused", async () => {
    vi.spyOn(api, "categories").mockResolvedValue({ categories: CATEGORIES });
    vi.spyOn(api, "course").mockResolvedValue({ course: aCourse() });
    vi.spyOn(api, "deleteCourse")
      .mockRejectedValue(new Error("Cannot delete a course with enrolled students"));

    renderForm("/instructor/courses/c1/edit");
    await userEvent.click(await screen.findByRole("button", { name: "Delete course" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    expect(await screen.findByText(/enrolled students/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Edit course" })).toBeInTheDocument();
  });
});

describe("CourseForm — lesson editor", () => {
  const LESSONS = [
    { _id: "l1", title: "Intro", durationMin: 10 },
    { _id: "l2", title: "Setup", durationMin: 20 },
    { _id: "l3", title: "Hooks", durationMin: 30 },
  ];

  /** Standard edit-mode boot: categories plus a draft course carrying LESSONS. */
  function mockLoad(lessons = LESSONS) {
    vi.spyOn(api, "categories").mockResolvedValue({ categories: CATEGORIES });
    vi.spyOn(api, "course").mockResolvedValue({ course: aCourse({ status: "draft", lessons }) });
  }

  /** Renders the edit route and waits until the course has loaded. */
  async function renderEditor() {
    renderForm("/instructor/courses/c1/edit");
    await screen.findByDisplayValue("React from Zero");
  }

  // The list is an <ol> because order is part of the data — each row shows
  // title + duration in server order, and the header sums the runtime.
  it("renders the lessons in order with durations", async () => {
    mockLoad();
    await renderEditor();

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Intro");
    expect(rows[0]).toHaveTextContent("10m");
    expect(rows[2]).toHaveTextContent("Hooks");
    expect(screen.getByText(/3 lessons · 1h/)).toBeInTheDocument();
  });

  // Add appends the server's created lesson (with its real _id) — never a
  // locally-invented one.
  it("adds a lesson through api.addLesson", async () => {
    mockLoad();
    const spy = vi.spyOn(api, "addLesson")
      .mockResolvedValue({ lesson: { _id: "l4", title: "Deploy", durationMin: 15 } });
    await renderEditor();

    await userEvent.type(screen.getByLabelText("Lesson title"), "Deploy");
    await userEvent.type(screen.getByLabelText("Duration (min)"), "15");
    await userEvent.click(screen.getByRole("button", { name: "Add lesson" }));

    expect(spy).toHaveBeenCalledWith("c1", { title: "Deploy", durationMin: 15 });
    expect(await screen.findByText("Deploy")).toBeInTheDocument();
  });

  // Client mirrors the server's "title required" rule — no request fires.
  it("blocks adding a lesson with an empty title", async () => {
    mockLoad();
    const spy = vi.spyOn(api, "addLesson");
    await renderEditor();

    await userEvent.click(screen.getByRole("button", { name: "Add lesson" }));

    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  // durationMin must be a non-negative integer (empty is fine — it becomes 0).
  it("rejects a negative duration without calling the API", async () => {
    mockLoad();
    const spy = vi.spyOn(api, "addLesson");
    await renderEditor();

    await userEvent.type(screen.getByLabelText("Lesson title"), "Deploy");
    await userEvent.type(screen.getByLabelText("Duration (min)"), "-5");
    await userEvent.click(screen.getByRole("button", { name: "Add lesson" }));

    expect(await screen.findByText(/non-negative/i)).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  // Edit swaps the row into inputs and PATCHes only that lesson; the row
  // re-renders from the server's response.
  it("edits a lesson through api.updateLesson", async () => {
    mockLoad();
    const spy = vi.spyOn(api, "updateLesson")
      .mockResolvedValue({ lesson: { _id: "l1", title: "Intro 2", durationMin: 10 } });
    await renderEditor();

    await userEvent.click(screen.getByRole("button", { name: "Edit Intro" }));
    const row = screen.getAllByRole("listitem")[0];
    await userEvent.type(within(row).getByLabelText("Lesson title"), " 2");
    await userEvent.click(within(row).getByRole("button", { name: "Save" }));

    expect(spy).toHaveBeenCalledWith("c1", "l1", { title: "Intro 2", durationMin: 10 });
    expect(await screen.findByText("Intro 2")).toBeInTheDocument();
  });

  // Delete is two-step like the course's own danger zone; the list then
  // mirrors the server's remaining array.
  it("deletes a lesson after the inline confirm", async () => {
    mockLoad();
    const spy = vi.spyOn(api, "deleteLesson")
      .mockResolvedValue({ lessons: [LESSONS[0], LESSONS[2]] });
    await renderEditor();

    await userEvent.click(screen.getByRole("button", { name: "Delete Setup" }));
    expect(spy).not.toHaveBeenCalled(); // first click only opens the confirm
    await userEvent.click(screen.getByRole("button", { name: "Confirm delete Setup" }));

    expect(spy).toHaveBeenCalledWith("c1", "l2");
    await waitFor(() => expect(screen.queryByText("Setup")).not.toBeInTheDocument());
  });

  // ↑/↓ send the whole reordered id array, and the UI renders whatever order
  // the server confirms back.
  it("reorders lessons with the arrow buttons", async () => {
    mockLoad();
    const spy = vi.spyOn(api, "reorderLessons")
      .mockResolvedValueOnce({ lessons: [LESSONS[1], LESSONS[0], LESSONS[2]] })
      .mockResolvedValueOnce({ lessons: LESSONS });
    await renderEditor();

    await userEvent.click(screen.getByRole("button", { name: "Move Setup up" }));
    expect(spy).toHaveBeenNthCalledWith(1, "c1", ["l2", "l1", "l3"]);
    await waitFor(() =>
      expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Setup")
    );

    await userEvent.click(screen.getByRole("button", { name: "Move Setup down" }));
    expect(spy).toHaveBeenNthCalledWith(2, "c1", ["l1", "l2", "l3"]);
    await waitFor(() =>
      expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Intro")
    );
  });

  // The ends can't move past themselves.
  it("disables ↑ on the first lesson and ↓ on the last", async () => {
    mockLoad();
    await renderEditor();

    expect(screen.getByRole("button", { name: "Move Intro up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Hooks down" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Setup up" })).toBeEnabled();
  });

  // Server rejections (403/404/validation) surface verbatim, same contract as
  // the rest of the form.
  it("shows the server's error message when a mutation fails", async () => {
    mockLoad();
    vi.spyOn(api, "addLesson").mockRejectedValue(new Error("Lesson title too long"));
    await renderEditor();

    await userEvent.type(screen.getByLabelText("Lesson title"), "Deploy");
    await userEvent.click(screen.getByRole("button", { name: "Add lesson" }));

    expect(await screen.findByText("Lesson title too long")).toBeInTheDocument();
  });

  // Create mode has no course id — there's nothing to attach a lesson to, so
  // the whole section stays hidden until the course exists.
  it("does not render the lesson editor in create mode", async () => {
    vi.spyOn(api, "categories").mockResolvedValue({ categories: CATEGORIES });

    renderForm("/instructor/courses/new");

    expect(await screen.findByRole("heading", { name: "New course" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Lessons" })).not.toBeInTheDocument();
  });
});
