import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDocumentTitle } from "./useDocumentTitle";

describe("useDocumentTitle", () => {
  it("suffixes the brand and updates when the title changes", () => {
    const { rerender } = renderHook(({ t }) => useDocumentTitle(t), { initialProps: { t: "Catalog" } });
    expect(document.title).toBe("Catalog · StudyNotion");
    rerender({ t: "Intro to TS" });
    expect(document.title).toBe("Intro to TS · StudyNotion");
  });

  it("falls back to the brand tagline without a title", () => {
    renderHook(() => useDocumentTitle());
    expect(document.title).toBe("StudyNotion — Learn. Build. Ship.");
  });
});
