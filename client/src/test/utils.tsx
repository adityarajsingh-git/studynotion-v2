import { ReactElement } from "react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { render } from "@testing-library/react";
import auth, { AuthState } from "../store/authSlice";
import { ApiCourse, ApiUser } from "../lib/api";

/** Defaults to a booted, signed-out session — the common starting point. */
export function makeStore(preloadedAuth?: Partial<AuthState>) {
  const auth0: AuthState = {
    user: null, status: "idle", error: null, booted: true, ...preloadedAuth,
  };
  return configureStore({
    reducer: { auth },
    preloadedState: preloadedAuth ? { auth: auth0 } : undefined,
  });
}

export type TestStore = ReturnType<typeof makeStore>;

/** Renders a tree with a real store and router around it. */
export function renderWithProviders(
  ui: ReactElement,
  { store = makeStore(), route = "/" }: { store?: TestStore; route?: string } = {}
) {
  return {
    store,
    ...render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </Provider>
    ),
  };
}

export const aUser = (overrides: Partial<ApiUser> = {}): ApiUser => ({
  id: "u1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  role: "student",
  enrolledCourses: [],
  ...overrides,
});

export const aCourse = (overrides: Partial<ApiCourse> = {}): ApiCourse => ({
  _id: "c1",
  title: "React from Zero",
  description: "A hands-on course",
  price: 499,
  thumbnailColor: "#d9a54f",
  instructor: { name: "Demo Instructor" },
  category: { name: "Web Development" },
  lessons: [{ title: "Lesson 1", durationMin: 30 }],
  studentCount: 0,
  ...overrides,
});
