import { useEffect, useState } from "react";

export function useIsNarrow(breakpoint = 640): boolean {
  const query = `(max-width: ${breakpoint - 1}px)`;
  const [isNarrow, setIsNarrow] = useState<boolean>(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setIsNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return isNarrow;
}

export function tickInterval(
  length: number,
  isNarrow: boolean,
  desktopMaxTicks = 9,
  mobileMaxTicks = 5,
): number {
  const maxTicks = isNarrow ? mobileMaxTicks : desktopMaxTicks;
  return Math.max(0, Math.ceil(length / maxTicks) - 1);
}
