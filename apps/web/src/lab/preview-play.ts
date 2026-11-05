import { useState, useEffect } from "react";

export function usePreviewPlay(): boolean {
  const [play, setPlay] = useState<boolean>(true);

  // Simple play state: start as true, user can toggle via localStorage
  useEffect(() => {
    const stored = localStorage.getItem("cs-preview-play");
    if (stored === "true") setPlay(true);
    else if (stored === "false") setPlay(false);
  }, []);

  return play;
}