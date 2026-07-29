import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { aUser, makeStore, renderWithProviders } from "../test/utils";

const Secret = () => <p>secret content</p>;
const LoginStub = () => <p>login page</p>;

function renderAt(store: ReturnType<typeof makeStore>) {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginStub />} />
      <Route path="/dashboard" element={<ProtectedRoute><Secret /></ProtectedRoute>} />
    </Routes>,
    { store, route: "/dashboard" }
  );
}

describe("ProtectedRoute", () => {
  it("waits for the session to boot before deciding", () => {
    renderAt(makeStore({ user: null, booted: false }));

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByText("login page")).not.toBeInTheDocument();
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
  });

  it("redirects to login once booted with no user", () => {
    renderAt(makeStore({ user: null, booted: true }));

    expect(screen.getByText("login page")).toBeInTheDocument();
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
  });

  it("renders the child for a signed-in user", () => {
    renderAt(makeStore({ user: aUser(), booted: true }));
    expect(screen.getByText("secret content")).toBeInTheDocument();
  });
});

const InstructorOnly = () => <p>instructor content</p>;
const DashStub = () => <p>dashboard page</p>;

function renderInstructorRoute(store: ReturnType<typeof makeStore>) {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginStub />} />
      <Route path="/dashboard" element={<DashStub />} />
      <Route
        path="/instructor/courses/new"
        element={<ProtectedRoute role="instructor"><InstructorOnly /></ProtectedRoute>}
      />
    </Routes>,
    { store, route: "/instructor/courses/new" }
  );
}

describe("ProtectedRoute with a role", () => {
  // A signed-in student on an instructor-only route goes to their dashboard —
  // NOT to /login, because they're already authenticated.
  it("redirects a student to /dashboard from an instructor route", () => {
    renderInstructorRoute(makeStore({ user: aUser({ role: "student" }), booted: true }));

    expect(screen.getByText("dashboard page")).toBeInTheDocument();
    expect(screen.queryByText("instructor content")).not.toBeInTheDocument();
    expect(screen.queryByText("login page")).not.toBeInTheDocument();
  });

  // The matching role passes straight through to the child.
  it("lets an instructor into an instructor route", () => {
    renderInstructorRoute(makeStore({ user: aUser({ role: "instructor" }), booted: true }));
    expect(screen.getByText("instructor content")).toBeInTheDocument();
  });

  // Signed-out users still get the login redirect even on role-gated routes.
  it("still sends signed-out visitors to login", () => {
    renderInstructorRoute(makeStore({ user: null, booted: true }));
    expect(screen.getByText("login page")).toBeInTheDocument();
  });
});
