import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// Required for React 19 act() to operate in jsdom.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { usePolling } from "@/lib/use-polling";

// Tiny renderHook substitute (avoids needing @testing-library/react as a dep).
function renderHook<T>(hook: () => T): { unmount: () => void; current: { value: T | null } } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const ref: { value: T | null } = { value: null };

  function Host() {
    ref.value = hook();
    return null;
  }

  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(React.createElement(Host));
  });

  return {
    current: ref,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("usePolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("polls on the given interval and skips ticks while hidden", async () => {
    const fetcher = vi.fn().mockResolvedValue({ n: 1 });

    const { unmount } = renderHook(() =>
      usePolling(fetcher, { intervalMs: 5000 }),
    );

    // Allow initial mount-tick to flush.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Advance one interval.
    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(2);

    // Tab goes hidden — interval is cleared.
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });

    // Advance well past several intervals; no extra fetches.
    await act(async () => {
      vi.advanceTimersByTime(20000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(2);

    // Tab back to visible — immediate refresh + resumed polling.
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(3);

    unmount();
  });
});
