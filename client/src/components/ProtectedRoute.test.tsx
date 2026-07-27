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
