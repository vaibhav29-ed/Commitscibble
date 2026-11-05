import { useEffect, useRef, useState } from "react";

interface UseInViewOptions {
  /** Stop observing after the element first enters the viewport. */
  once?: boolean;
  rootMargin?: string;
  threshold?: number;
}

/**
 * Tracks whether an element is in the viewport. The fallback keeps motion
 * usable in environments without IntersectionObserver (including tests).
 */
export function useInView<T extends Element>({
  once = false,
  rootMargin = "0px 0px -12% 0px",
  threshold = 0.18,
}: UseInViewOptions = {}) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { rootMargin, threshold },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [once, rootMargin, threshold]);

  return { ref, inView };
}
