import { useEffect } from "react";

const BASE = "StudyNotion";

/** Sets the tab title to "<title> · StudyNotion"; no title falls back to the bare brand. */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE}` : `${BASE} — Learn. Build. Ship.`;
  }, [title]);
}
