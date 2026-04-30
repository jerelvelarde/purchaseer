"use client";

import { useEffect, useRef, useState } from "react";

export type UsePollingState<T> = {
  data: T | null;
  error: Error | null;
  loading: boolean;
  /** Manually re-fetch right now (e.g. after a mutation). */
  refresh: () => void;
};

/**
 * Lightweight polling hook (ADR-3): fetch on mount, poll on an interval,
 * and pause polling while the document is hidden. Resumes immediately on
 * `visibilitychange` -> visible (and triggers a fresh fetch so the user
 * sees up-to-date data when they tab back in).
 *
 * Cleans up the timer + listener on unmount.
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  options: { intervalMs?: number } = {},
): UsePollingState<T> {
  const { intervalMs = 5000 } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const tickRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    mountedRef.current = true;

    const tick = async () => {
      if (inFlightRef.current) return;
      // Belt-and-suspenders: skip the actual fetch if hidden.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      inFlightRef.current = true;
      try {
        const next = await fetcherRef.current();
        if (mountedRef.current) {
          setData(next);
          setError(null);
        }
      } catch (e) {
        if (mountedRef.current) {
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current) setLoading(false);
      }
    };
    tickRef.current = tick;

    const start = () => {
      if (timerRef.current != null) return;
      timerRef.current = setInterval(tick, intervalMs);
    };
    const stop = () => {
      if (timerRef.current != null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    const onVisibility = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "hidden") {
        stop();
      } else {
        // Resume: fetch immediately so the user sees fresh data, then poll.
        void tick();
        start();
      }
    };

    // Initial fetch.
    void tick();

    if (typeof document !== "undefined") {
      if (document.visibilityState !== "hidden") start();
      document.addEventListener("visibilitychange", onVisibility);
    } else {
      start();
    }

    return () => {
      mountedRef.current = false;
      stop();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [intervalMs]);

  return {
    data,
    error,
    loading,
    refresh: () => {
      void tickRef.current();
    },
  };
}
