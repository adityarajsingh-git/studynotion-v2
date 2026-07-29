import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
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
