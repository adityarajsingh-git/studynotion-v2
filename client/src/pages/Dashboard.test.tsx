import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import Dashboard from "./Dashboard";
import { aUser, makeStore, renderWithProviders } from "../test/utils";

const withCourses = aUser({
  name: "Ada Lovelace",
  enrolledCourses: [
    { _id: "c1", title: "React from Zero", price: 499, thumbnailColor: "#d9a54f" },
    { _id: "c2", title: "MongoDB Modelling", price: 349, thumbnailColor: "#8d5dc9" },
  ],
});

describe("Dashboard", () => {
  it("greets the user by first name", () => {
    renderWithProviders(<Dashboard />, { store: makeStore({ user: aUser() }) });
    expect(screen.getByRole("heading", { name: /Hi, Ada/ })).toBeInTheDocument();
  });

  it("shows the email and role", () => {
    renderWithProviders(<Dashboard />, { store: makeStore({ user: aUser({ role: "instructor" }) }) });
    expect(screen.getByText(/ada@example.com/)).toBeInTheDocument();
    expect(screen.getByText("instructor")).toBeInTheDocument();
  });

  it("prompts an empty user towards the catalog", () => {
    renderWithProviders(<Dashboard />, { store: makeStore({ user: aUser() }) });

    expect(screen.getByText(/Nothing yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse the catalog/i })).toHaveAttribute("href", "/courses");
  });

  // Regression: this is what the login-response bug broke — a user with
  // enrollments saw the empty state until they hard-reloaded.
  it("renders enrolled courses when the session carries them", () => {
    renderWithProviders(<Dashboard />, { store: makeStore({ user: withCourses }) });

    expect(screen.queryByText(/Nothing yet/)).not.toBeInTheDocument();
    expect(screen.getByText("React from Zero")).toBeInTheDocument();
    expect(screen.getByText("MongoDB Modelling")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /React from Zero/ })).toHaveAttribute("href", "/courses/c1");
  });
});
