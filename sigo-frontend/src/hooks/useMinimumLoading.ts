import { useEffect, useRef, useState } from "react";

export function useMinimumLoading(isLoading: boolean, duration = 500) {
  const [isVisible, setIsVisible] = useState(isLoading);
  const [cycle, setCycle] = useState(isLoading ? 1 : 0);
  const startedAt = useRef<number | null>(isLoading ? Date.now() : null);
  const wasLoading = useRef(isLoading);

  useEffect(() => {
    if (isLoading) {
      if (!wasLoading.current || startedAt.current === null) {
        startedAt.current = Date.now();
        setCycle((current) => current + 1);
      }
      wasLoading.current = true;
      setIsVisible(true);
      return;
    }

    wasLoading.current = false;
    if (startedAt.current === null) {
      setIsVisible(false);
      return;
    }
    const elapsed = Date.now() - startedAt.current;
    const remaining = Math.max(0, duration - elapsed);
    const timeout = window.setTimeout(() => {
      setIsVisible(false);
      startedAt.current = null;
    }, remaining);

    return () => window.clearTimeout(timeout);
  }, [duration, isLoading]);

  return { isVisible, cycle };
}
