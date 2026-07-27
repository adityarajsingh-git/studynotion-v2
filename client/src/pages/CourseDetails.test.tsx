import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { api } from "../lib/api";
import CourseDetails from "./CourseDetails";
import Dashboard from "./Dashboard";
import { aCourse, aUser, makeStore, renderWithProviders } from "../test/utils";

const course = aCourse({
  _id: "c1",
  title: "React from Zero",
  lessons: [
    { title: "Intro", durationMin: 30 },
    { title: "Hooks", durationMin: 45 },
  ],
});

function renderDetails(store = makeStore({ user: aUser(), booted: true })) {
  return renderWithProviders(
    <Routes>
      <Route path="/courses/:id" element={<CourseDetails />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>,
    { store, route: "/courses/c1" }
  );
}

describe("CourseDetails", () => {
  it("renders the course once loaded", async () => {
    vi.spyOn(api, "course").mockResolvedValue({ course });

    renderDetails();

    expect(await screen.findByRole("heading", { name: "React from Zero" })).toBeInTheDocument();
    expect(screen.getByText("₹499")).toBeInTheDocument();
    expect(screen.getByText(/2 lessons · 1h 15m/)).toBeInTheDocument();
    expect(screen.getByText("1. Intro")).toBeInTheDocument();
    expect(screen.getByText("2. Hooks")).toBeInTheDocument();
  });

  it("asks anonymous visitors to log in instead of showing Enroll", async () => {
    vi.spyOn(api, "course").mockResolvedValue({ course });

    renderDetails(makeStore({ user: null, booted: true }));

    expect(await screen.findByText(/Log in to enroll/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Enroll/i })).not.toBeInTheDocument();
  });

  it("shows the failure message when the course can't be fetched", async () => {
    vi.spyOn(api, "course").mockRejectedValue(new Error("Course not found"));

    renderDetails();

    expect(await screen.findByText("Course not found")).toBeInTheDocument();
  });

  // Regression: enrolling hit the API but never refreshed the store, so the
  // dashboard still showed the empty state until a hard reload.
  it("refreshes the session after enrolling so the dashboard is up to date", async () => {
    vi.spyOn(api, "course").mockResolvedValue({ course });
    vi.spyOn(api, "enroll").mockResolvedValue({ message: "Enrolled — payment flow lands in Week 3" });
    const meSpy = vi.spyOn(api, "me").mockResolvedValue({
      user: aUser({
        enrolledCourses: [{ _id: "c1", title: "React from Zero", price: 499, thumbnailColor: "#d9a54f" }],
      }),
    });

    const { store, unmount } = renderDetails();
    await userEvent.click(await screen.findByRole("button", { name: /Enroll/i }));

    expect(await screen.findByText(/Enrolled/)).toBeInTheDocument();
    await waitFor(() => expect(meSpy).toHaveBeenCalled());

    // The store now carries the enrollment...
    expect(store.getState().auth.user?.enrolledCourses).toHaveLength(1);

    // ...so the dashboard renders it without a reload.
    unmount();
    renderWithProviders(<Dashboard />, { store });
    expect(screen.getByText("React from Zero")).toBeInTheDocument();
    expect(screen.queryByText(/Nothing yet/)).not.toBeInTheDocument();
  });

  it("reports an enrollment failure and leaves the session alone", async () => {
    vi.spyOn(api, "course").mockResolvedValue({ course });
    vi.spyOn(api, "enroll").mockRejectedValue(new Error("Already enrolled"));
    const meSpy = vi.spyOn(api, "me");

    const { store } = renderDetails();
    await userEvent.click(await screen.findByRole("button", { name: /Enroll/i }));

    expect(await screen.findByText("Already enrolled")).toBeInTheDocument();
    expect(meSpy).not.toHaveBeenCalled();
    expect(store.getState().auth.user?.enrolledCourses).toHaveLength(0);
  });

  it("disables the button while the request is in flight", async () => {
    vi.spyOn(api, "course").mockResolvedValue({ course });
    let release: (v: { message: string }) => void = () => {};
    vi.spyOn(api, "enroll").mockReturnValue(new Promise((r) => { release = r; }));
    vi.spyOn(api, "me").mockResolvedValue({ user: aUser() });

    renderDetails();
    await userEvent.click(await screen.findByRole("button", { name: /Enroll/i }));

    const button = screen.getByRole("button", { name: /Enrolling…/ });
    expect(button).toBeDisabled();

    release({ message: "done" });
    await waitFor(() => expect(screen.getByRole("button", { name: /Enroll/i })).toBeEnabled());
  });
});
