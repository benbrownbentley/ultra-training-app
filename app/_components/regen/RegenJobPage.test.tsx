// @vitest-environment jsdom

// Regression test for the auto-dismiss timer in RegenJobPage. The
// 8-second ceremony was specced in PROJECT_BRIEF.md → "Regen async +
// notification UX (2026-05-28)" — but the first implementation
// listed `router` in the timer effect's dep array, and Next 16's
// `useRouter()` returns a fresh object identity on every render.
// Re-renders coming from the child GeneratingPhaseState (which
// ticks its own elapsed-time state) reset the timer, so the
// ceremony never dismissed.
//
// This test mocks `useRouter` to return a fresh stable-shape object
// per render AND mocks GeneratingPhaseState to render something
// inert (no real fetches), then verifies that after the ceremony
// duration plus a slew of forced parent re-renders the
// `router.replace("/")` call fires exactly once.

import { act, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { RegenJobPage } from "./RegenJobPage";

// Spy backing the mocked useRouter — both the assertion target and
// re-used across renders via a stable wrapper. The `replace` fn is a
// fresh vi.fn() per test (assigned in beforeEach) so call counts
// don't leak between tests.
let replaceMock: ReturnType<typeof vi.fn<(href: string) => void>>;

// Mock next/navigation BEFORE importing the component under test
// (handled via vi.mock at module level — hoisted by vitest). Returns
// a NEW object literal every call to reproduce the Next 16 behaviour
// that caused the original bug.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: (href: string) => replaceMock(href),
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock GeneratingPhaseState so the test doesn't have to stub out
// the orchestrator + Supabase machinery the real component pulls in.
// It just renders a stable placeholder; the test forces re-renders
// of RegenJobPage's parent via state changes below.
vi.mock("@/app/_components/generating/GeneratingPhaseState", () => ({
  GeneratingPhaseState: () => null,
}));

describe("RegenJobPage — auto-dismiss timer", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    replaceMock = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  it("calls router.replace('/') exactly once after 8s — survives intermediate re-renders", () => {
    // Wrap the page in a controllable parent so the test can force
    // re-renders mid-ceremony. Each setTick increment causes a new
    // render of RegenJobPage, which the bug used to interpret as a
    // dep-change signal that reset the timer.
    function Harness() {
      const [, setTick] = useState(0);
      useEffect(() => {
        // Schedule 7 re-renders spread across the 8s window. With the
        // buggy dep array each one cleared the prior timer and armed
        // a fresh 8s timer; with the ref-based fix the original timer
        // keeps counting down.
        const interval = window.setInterval(() => {
          setTick((t) => t + 1);
        }, 1000);
        return () => window.clearInterval(interval);
      }, []);
      return <RegenJobPage jobId={42} />;
    }

    act(() => {
      root.render(<Harness />);
    });

    // Advance just shy of the ceremony duration — no dismiss yet.
    act(() => {
      vi.advanceTimersByTime(7999);
    });
    expect(replaceMock).not.toHaveBeenCalled();

    // Cross the 8s threshold — replace fires.
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith("/");

    // Advance further — should NOT fire again (cleanup clears any
    // duplicate timers; the ref pattern arms exactly one).
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(replaceMock).toHaveBeenCalledTimes(1);
  });
});
