import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "../lib/api";
import Catalog from "./Catalog";
import { aCourse, renderWithProviders } from "../test/utils";

const CATEGORIES = [
  { _id: "cat1", name: "Web Development" },
  { _id: "cat2", name: "Data & Databases" },
];

describe("Catalog", () => {
  it("renders the fetched courses", async () => {
    vi.spyOn(api, "categories").mockResolvedValue({ categories: CATEGORIES });
    vi.spyOn(api, "courses").mockResolvedValue({
      courses: [aCourse({ _id: "c1", title: "React from Zero" }), aCourse({ _id: "c2", title: "MongoDB Modelling" })],
    });

    renderWithProviders(<Catalog />);

    expect(await screen.findByText("React from Zero")).toBeInTheDocument();
    expect(screen.getByText("MongoDB Modelling")).toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", async () => {
    vi.spyOn(api, "categories").mockResolvedValue({ categories: [] });
    vi.spyOn(api, "courses").mockResolvedValue({ courses: [] });

    renderWithProviders(<Catalog />);

    expect(await screen.findByText(/No courses match/)).toBeInTheDocument();
  });

  it("shows a recoverable error when the API is down", async () => {
    vi.spyOn(api, "categories").mockRejectedValue(new Error("offline"));
    vi.spyOn(api, "courses").mockRejectedValue(new Error("Failed to fetch"));

    renderWithProviders(<Catalog />);

    expect(await screen.findByText(/Couldn't load courses/)).toBeInTheDocument();
    expect(screen.getByText(/Failed to fetch/)).toBeInTheDocument();
  });

  it("passes the category filter through as a query param", async () => {
    vi.spyOn(api, "categories").mockResolvedValue({ categories: CATEGORIES });
    const spy = vi.spyOn(api, "courses").mockResolvedValue({ courses: [] });

    renderWithProviders(<Catalog />);
    await screen.findByRole("option", { name: "Web Development" });

    await userEvent.selectOptions(screen.getByRole("combobox"), "cat1");

    await waitFor(() => expect(spy).toHaveBeenLastCalledWith("?category=cat1"));
  });

  it("passes the search term through as a query param", async () => {
    vi.spyOn(api, "categories").mockResolvedValue({ categories: CATEGORIES });
    const spy = vi.spyOn(api, "courses").mockResolvedValue({ courses: [] });

    renderWithProviders(<Catalog />);
    await userEvent.type(screen.getByPlaceholderText(/Search courses/), "react");

    await waitFor(() => expect(spy).toHaveBeenLastCalledWith("?search=react"));
  });

  it("requests the unfiltered list on first load", async () => {
    vi.spyOn(api, "categories").mockResolvedValue({ categories: [] });
    const spy = vi.spyOn(api, "courses").mockResolvedValue({ courses: [] });

    renderWithProviders(<Catalog />);

    await waitFor(() => expect(spy).toHaveBeenCalledWith(""));
  });
});
