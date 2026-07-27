import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import App from "./App";
import { aUser, makeStore, renderWithProviders } from "./test/utils";

describe("routing", () => {
  it("renders the landing page at /", () => {
    renderWithProviders(<App />, { route: "/" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Learn. Build. Ship./);
  });

  it("renders the login page at /login", () => {
    renderWithProviders(<App />, { route: "/login" });
    expect(screen.getByRole("heading", { name: /Welcome back/i })).toBeInTheDocument();
  });

  // Regression: without a catch-all, an unknown URL rendered a blank page
  // between the navbar and the footer.
  it.each(["/nope", "/courses/x/y/z", "/dashboard/settings"])(
    "renders a 404 page at %s",
    (route) => {
      renderWithProviders(<App />, { route });
      expect(screen.getByText("404")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /Page not found/i })).toBeInTheDocument();
    }
  );

  it("offers a way out of the 404 page", () => {
    renderWithProviders(<App />, { route: "/nope" });
    expect(screen.getByRole("link", { name: /Back home/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /Browse catalog/i })).toHaveAttribute("href", "/courses");
  });

  it("keeps the navbar and footer around the 404 page", () => {
    renderWithProviders(<App />, { route: "/nope" });
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByText(/built by Adityaraj Singh/)).toBeInTheDocument();
  });

  it("bounces an anonymous visitor off /dashboard", () => {
    renderWithProviders(<App />, { store: makeStore({ user: null, booted: true }), route: "/dashboard" });
    expect(screen.getByRole("heading", { name: /Welcome back/i })).toBeInTheDocument();
  });

  it("shows the dashboard to a signed-in user", () => {
    renderWithProviders(<App />, { store: makeStore({ user: aUser(), booted: true }), route: "/dashboard" });
    expect(screen.getByRole("heading", { name: /Hi, Ada/ })).toBeInTheDocument();
  });
});

describe("Navbar", () => {
  it("shows auth links when signed out", () => {
    renderWithProviders(<App />, { route: "/" });
    expect(screen.getByRole("link", { name: /Log in/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sign up/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Log out/i })).not.toBeInTheDocument();
  });

  it("shows dashboard and logout when signed in", () => {
    renderWithProviders(<App />, { store: makeStore({ user: aUser(), booted: true }), route: "/" });
    expect(screen.getByRole("link", { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Log out/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Log in$/i })).not.toBeInTheDocument();
  });
});
