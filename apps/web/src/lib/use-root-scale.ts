import { useEffect } from "react";

/**
 * Temporarily applies a root font-size class to `<html>` for the lifetime of a
 * route. The supplied design uses a 12px root scale, while the legacy app used
 * the browser default; toggling the class keeps both marketing and dashboard
 * surfaces measured exactly as designed without a global font-size reset.
 */
export function useRootScale(className: string) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add(className);
    return () => root.classList.remove(className);
  }, [className]);
}
