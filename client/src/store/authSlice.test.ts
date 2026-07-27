import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import { makeStore, aUser } from "../test/utils";
import { bootSession, clearAuthError, login, logout, refreshUser, signup } from "./authSlice";

describe("authSlice", () => {
  beforeEach(() => localStorage.clear());

  it("starts empty and un-booted", () => {
    const { auth } = makeStore().getState();
    expect(auth).toEqual({ user: null, status: "idle", error: null, booted: false });
  });

  describe("login", () => {
    it("stores the token and user on success", async () => {
      const user = aUser();
      vi.spyOn(api, "login").mockResolvedValue({ token: "jwt-123", user });

      const store = makeStore();
      await store.dispatch(login({ email: "ada@example.com", password: "secret123" }));

      expect(store.getState().auth.user).toEqual(user);
      expect(store.getState().auth.status).toBe("idle");
      expect(localStorage.getItem("sn2_token")).toBe("jwt-123");
    });

    it("records the error message on failure and leaves the user null", async () => {
      vi.spyOn(api, "login").mockRejectedValue(new Error("Invalid credentials"));

      const store = makeStore();
      await store.dispatch(login({ email: "ada@example.com", password: "wrong" }));

      expect(store.getState().auth).toMatchObject({
        user: null, status: "error", error: "Invalid credentials",
      });
      expect(localStorage.getItem("sn2_token")).toBeNull();
    });

    it("flips to loading while in flight", async () => {
      let release: (v: { token: string; user: ReturnType<typeof aUser> }) => void = () => {};
      vi.spyOn(api, "login").mockReturnValue(new Promise((r) => { release = r; }));

      const store = makeStore();
      const pending = store.dispatch(login({ email: "a@b.co", password: "secret123" }));
      expect(store.getState().auth.status).toBe("loading");

      release({ token: "t", user: aUser() });
      await pending;
      expect(store.getState().auth.status).toBe("idle");
    });
  });

  // Regression: Login and Signup share one error field, so a failure on one
  // form used to render on the other.
  describe("clearAuthError", () => {
    it("wipes a previous failure", async () => {
      vi.spyOn(api, "login").mockRejectedValue(new Error("Invalid credentials"));
      const store = makeStore();
      await store.dispatch(login({ email: "a@b.co", password: "wrong" }));
      expect(store.getState().auth.error).toBe("Invalid credentials");

      store.dispatch(clearAuthError());

      expect(store.getState().auth.error).toBeNull();
      expect(store.getState().auth.status).toBe("idle");
    });

    it("leaves the signed-in user alone", () => {
      const store = makeStore({ user: aUser() });
      store.dispatch(clearAuthError());
      expect(store.getState().auth.user).not.toBeNull();
    });
  });

  // Regression: enrolling updated the server but never the store, so the
  // dashboard stayed empty until a full page reload.
  describe("refreshUser", () => {
    it("replaces the user with the freshly fetched session", async () => {
      const enrolled = aUser({
        enrolledCourses: [{ _id: "c1", title: "React from Zero", price: 499, thumbnailColor: "#d9a54f" }],
      });
      vi.spyOn(api, "me").mockResolvedValue({ user: enrolled });

      const store = makeStore({ user: aUser() });
      expect(store.getState().auth.user?.enrolledCourses).toHaveLength(0);

      await store.dispatch(refreshUser());

      expect(store.getState().auth.user?.enrolledCourses).toHaveLength(1);
      expect(store.getState().auth.user?.enrolledCourses[0].title).toBe("React from Zero");
    });

    it("does not clobber the session when the refresh fails", async () => {
      vi.spyOn(api, "me").mockRejectedValue(new Error("network down"));
      const store = makeStore({ user: aUser() });

      await store.dispatch(refreshUser());

      expect(store.getState().auth.user).not.toBeNull();
    });
  });

  describe("bootSession", () => {
    it("marks booted without a call when there is no token", async () => {
      const spy = vi.spyOn(api, "me");
      const store = makeStore();

      await store.dispatch(bootSession());

      expect(spy).not.toHaveBeenCalled();
      expect(store.getState().auth).toMatchObject({ user: null, booted: true });
    });

    it("restores the session from a stored token", async () => {
      localStorage.setItem("sn2_token", "jwt-123");
      const user = aUser();
      vi.spyOn(api, "me").mockResolvedValue({ user });

      const store = makeStore();
      await store.dispatch(bootSession());

      expect(store.getState().auth).toMatchObject({ user, booted: true });
    });

    it("discards a token the server rejects", async () => {
      localStorage.setItem("sn2_token", "expired");
      vi.spyOn(api, "me").mockRejectedValue(new Error("Invalid or expired token"));

      const store = makeStore();
      await store.dispatch(bootSession());

      expect(store.getState().auth).toMatchObject({ user: null, booted: true });
      expect(localStorage.getItem("sn2_token")).toBeNull();
    });
  });

  describe("signup", () => {
    it("signs the new user straight in", async () => {
      const user = aUser({ role: "instructor" });
      vi.spyOn(api, "signup").mockResolvedValue({ token: "jwt-abc", user });

      const store = makeStore();
      await store.dispatch(signup({ name: "Ada", email: "ada@example.com", password: "secret123", role: "instructor" }));

      expect(store.getState().auth.user?.role).toBe("instructor");
      expect(localStorage.getItem("sn2_token")).toBe("jwt-abc");
    });
  });

  describe("logout", () => {
    it("clears both the user and the stored token", () => {
      localStorage.setItem("sn2_token", "jwt-123");
      const store = makeStore({ user: aUser() });

      store.dispatch(logout());

      expect(store.getState().auth.user).toBeNull();
      expect(localStorage.getItem("sn2_token")).toBeNull();
    });
  });
});
