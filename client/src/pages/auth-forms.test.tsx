import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "../lib/api";
import Login from "./Login";
import Signup from "./Signup";
import { aUser, makeStore, renderWithProviders } from "../test/utils";

describe("Login", () => {
  it("submits the typed credentials", async () => {
    const spy = vi.spyOn(api, "login").mockResolvedValue({ token: "t", user: aUser() });

    renderWithProviders(<Login />);
    await userEvent.type(screen.getByPlaceholderText("Email"), "ada@example.com");
    await userEvent.type(screen.getByPlaceholderText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: /Log in/i }));

    expect(spy).toHaveBeenCalledWith({ email: "ada@example.com", password: "secret123" });
  });

  it("surfaces a failed login", async () => {
    vi.spyOn(api, "login").mockRejectedValue(new Error("Invalid credentials"));

    renderWithProviders(<Login />);
    await userEvent.type(screen.getByPlaceholderText("Email"), "ada@example.com");
    await userEvent.type(screen.getByPlaceholderText("Password"), "wrongpass");
    await userEvent.click(screen.getByRole("button", { name: /Log in/i }));

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
  });

  // Regression: both forms read the same auth.error, so a signup failure
  // used to greet you on the login page.
  it("clears an error left behind by the signup form", () => {
    const store = makeStore({ status: "error", error: "Email already registered" });

    renderWithProviders(<Login />, { store });

    expect(screen.queryByText("Email already registered")).not.toBeInTheDocument();
    expect(store.getState().auth.error).toBeNull();
  });
});

describe("Signup", () => {
  it("defaults to the student role and submits the form", async () => {
    const spy = vi.spyOn(api, "signup").mockResolvedValue({ token: "t", user: aUser() });

    renderWithProviders(<Signup />);
    await userEvent.type(screen.getByPlaceholderText("Full name"), "Ada Lovelace");
    await userEvent.type(screen.getByPlaceholderText("Email"), "ada@example.com");
    await userEvent.type(screen.getByPlaceholderText(/Password/), "secret123");
    await userEvent.click(screen.getByRole("button", { name: /Sign up/i }));

    expect(spy).toHaveBeenCalledWith({
      name: "Ada Lovelace", email: "ada@example.com", password: "secret123", role: "student",
    });
  });

  it("can switch to the instructor role", async () => {
    const spy = vi.spyOn(api, "signup").mockResolvedValue({ token: "t", user: aUser() });

    renderWithProviders(<Signup />);
    await userEvent.type(screen.getByPlaceholderText("Full name"), "Grace");
    await userEvent.type(screen.getByPlaceholderText("Email"), "grace@example.com");
    await userEvent.type(screen.getByPlaceholderText(/Password/), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "instructor" }));
    await userEvent.click(screen.getByRole("button", { name: /Sign up/i }));

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ role: "instructor" }));
  });

  it("clears an error left behind by the login form", () => {
    const store = makeStore({ status: "error", error: "Invalid credentials" });

    renderWithProviders(<Signup />, { store });

    expect(screen.queryByText("Invalid credentials")).not.toBeInTheDocument();
    expect(store.getState().auth.error).toBeNull();
  });
});
