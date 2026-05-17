import { useEffect } from "react";

export function useEscapeKey(handler, enabled = true) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    function onKeyDown(event) {
      if (event.key === "Escape") {
        handler(event);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, handler]);
}
