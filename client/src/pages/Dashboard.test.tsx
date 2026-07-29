import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import Dashboard from "./Dashboard";
import { api } from "../lib/api";
import { aCourse, aUser, makeStore, renderWithProviders } from "../test/utils";

const withCourses = aUser({
  name: "Ada Lovelace",
  enrolledCourses: [
    { _id: "c1", title: "React from Zero", price: 499, thumbnailColor: "#d9a54f" },
    { _id: "c2", title: "MongoDB Modelling", price: 349, thumbnailColor: "#8d5dc9" },
  ],
});

const instructor = aUser({ role: "instructor" });

/** One published, one draft — the dashboard must show both, badges intact. */
const MINE = [
  aCourse({ _id: "c1", title: "React from Zero", status: "published", studentCount: 12, price: 499 }),
  aCourse({ _id: "c2", title: "MongoDB Modelling", status: "draft", studentCount: 0, price: 349 }),
];

function renderAs(user: ReturnType<typeof aUser>) {
  return renderWithProviders(<Dashboard />, { store: makeStore({ user }) });
}

describe("Dashboard", () => {
  it("greets the user by first name", () => {
    renderAs(aUser());
    expect(screen.getByRole("heading", { name: /Hi, Ada/ })).toBeInTheDocument();
  });

  it("shows the email and role", async () => {
    vi.spyOn(api, "myCourses").mockResolvedValue({ courses: [] });
    renderAs(instructor);
    expect(screen.getByText(/ada@example.com/)).toBeInTheDocument();
    expect(screen.getByText("instructor")).toBeInTheDocument();
  });

  it("prompts an empty user towards the catalog", () => {
    renderAs(aUser());

    expect(screen.getByText(/Nothing yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse the catalog/i })).toHaveAttribute("href", "/courses");
  });

  // Regression: this is what the login-response bug broke — a user with
  // enrollments saw the empty state until they hard-reloaded.
  it("renders enrolled courses when the session carries them", () => {
    renderAs(withCourses);

    expect(screen.queryByText(/Nothing yet/)).not.toBeInTheDocument();
    expect(screen.getByText("React from Zero")).toBeInTheDocument();
    expect(screen.getByText("MongoDB Modelling")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /React from Zero/ })).toHaveAttribute("href", "/courses/c1");
  });
});

describe("Dashboard — instructor view", () => {
  // The core promise of Commit 11: instructors see their own courses, and the
  // status of each one is spelled out in text, not just colour.
  it("lists the instructor's courses with Draft/Published badges", async () => {
    vi.spyOn(api, "myCourses").mockResolvedValue({ courses: MINE });
    renderAs(instructor);

    expect(await screen.findByText("React from Zero")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  // Drafts are invisible in the public catalog — the dashboard must NOT
  // inherit that filter, or instructors could never reach their drafts.
  it("shows draft and published courses side by side", async () => {
    vi.spyOn(api, "myCourses").mockResolvedValue({ courses: MINE });
    renderAs(instructor);

    expect(await screen.findByText("React from Zero")).toBeInTheDocument();
    expect(screen.getByText("MongoDB Modelling")).toBeInTheDocument();
  });

  // studentCount is the instructor's only enrollment signal — the server
  // never exposes the raw student ids.
  it("shows the student count for each course", async () => {
    vi.spyOn(api, "myCourses").mockResolvedValue({ courses: MINE });
    renderAs(instructor);

    expect(await screen.findByText(/12 students/)).toBeInTheDocument();
    expect(screen.getByText(/0 students/)).toBeInTheDocument();
  });

  // The Edit link is the entry point into the course builder — a wrong URL
  // here strands the instructor on the 404 page.
  it("links Edit to the course's edit route", async () => {
    vi.spyOn(api, "myCourses").mockResolvedValue({ courses: MINE });
    renderAs(instructor);

    await screen.findByText("React from Zero");
    const editLinks = screen.getAllByRole("link", { name: "Edit" });
    expect(editLinks[0]).toHaveAttribute("href", "/instructor/courses/c1/edit");
    expect(editLinks[1]).toHaveAttribute("href", "/instructor/courses/c2/edit");
  });

  // The create flow must be reachable straight from the dashboard.
  it("always offers a New course button", async () => {
    vi.spyOn(api, "myCourses").mockResolvedValue({ courses: MINE });
    renderAs(instructor);

    expect(await screen.findByRole("link", { name: "New course" })).toHaveAttribute(
      "href",
      "/instructor/courses/new"
    );
  });

  // A brand-new instructor lands on guidance, not a blank grid.
  it("shows the empty state when there are no courses", async () => {
    vi.spyOn(api, "myCourses").mockResolvedValue({ courses: [] });
    renderAs(instructor);

    expect(await screen.findByText(/No courses yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create your first one/i })).toHaveAttribute(
      "href",
      "/instructor/courses/new"
    );
  });

  // A failed fetch must surface as an error — rendering the empty state
  // instead would tell an instructor their courses are gone.
  it("shows the error, not the empty state, when myCourses fails", async () => {
    vi.spyOn(api, "myCourses").mockRejectedValue(new Error("Server exploded"));
    renderAs(instructor);

    expect(await screen.findByText(/Server exploded/)).toBeInTheDocument();
    expect(screen.queryByText(/No courses yet/)).not.toBeInTheDocument();
  });

  // Role isolation: a student keeps the enrolled view and never sees the
  // instructor chrome.
  it("keeps the enrolled view for students", () => {
    renderAs(withCourses);

    expect(screen.queryByRole("link", { name: "New course" })).not.toBeInTheDocument();
    expect(screen.queryByText("Published")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /React from Zero/ })).toHaveAttribute("href", "/courses/c1");
  });

  // The request itself must not fire for students — the server would 403 it
  // anyway, but the client shouldn't waste the round-trip.
  it("never calls api.myCourses for a student", () => {
    const spy = vi.spyOn(api, "myCourses");
    renderAs(withCourses);

    expect(spy).not.toHaveBeenCalled();
  });
});
