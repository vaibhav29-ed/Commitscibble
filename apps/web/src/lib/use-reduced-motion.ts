import { useEffect, useState } from "react";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mql.matches);

    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    mql.addEventListener?.("change", listener);

    return () => mql.removeEventListener?.("change", listener);
  }, []);

  return reduced;
}