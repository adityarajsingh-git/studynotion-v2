import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import CourseCard from "./CourseCard";
import { aCourse, renderWithProviders } from "../test/utils";

describe("CourseCard", () => {
  it("shows the title, price and category", () => {
    renderWithProviders(<CourseCard course={aCourse()} />);

    expect(screen.getByText("React from Zero")).toBeInTheDocument();
    expect(screen.getByText("₹499")).toBeInTheDocument();
    expect(screen.getByText("Web Development")).toBeInTheDocument();
  });

  it("links to the course detail page", () => {
    renderWithProviders(<CourseCard course={aCourse({ _id: "abc123" })} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/courses/abc123");
  });

  // Regression: a 25-minute course used to render "0h".
  it("shows short courses in minutes", () => {
    renderWithProviders(<CourseCard course={aCourse({ lessons: [{ _id: "l1", title: "L1", durationMin: 25 }] })} />);

    expect(screen.getByText(/1 lessons · 25m/)).toBeInTheDocument();
    expect(screen.queryByText(/0h/)).not.toBeInTheDocument();
  });

  it("shows longer courses in hours and minutes", () => {
    const lessons = Array.from({ length: 4 }, (_, i) => ({ _id: `l${i}`, title: `L${i}`, durationMin: 30 }));
    renderWithProviders(<CourseCard course={aCourse({ lessons })} />);

    expect(screen.getByText(/4 lessons · 2h/)).toBeInTheDocument();
  });

  it("falls back to a generic label when a course has no category", () => {
    renderWithProviders(<CourseCard course={aCourse({ category: undefined })} />);
    expect(screen.getByText("Course")).toBeInTheDocument();
  });
});
