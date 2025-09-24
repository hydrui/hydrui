import { renderHook } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useShortcut } from "./useShortcut";

describe("useShortcut", () => {
  const addEventListenerMock = vi.fn();
  const removeEventListenerMock = vi.fn();

  const originalAddEventListener = window.addEventListener;
  const originalRemoveEventListener = window.removeEventListener;

  beforeEach(() => {
    window.addEventListener = addEventListenerMock;
    window.removeEventListener = removeEventListenerMock;
  });

  afterEach(() => {
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;

    vi.clearAllMocks();
  });

  it("should add global keydown event listener on mount", () => {
    const callback = vi.fn();
    renderHook(() => useShortcut({ "Control+S": callback }));

    expect(addEventListenerMock).toHaveBeenCalledTimes(1);
    expect(addEventListenerMock).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function),
    );
  });

  it("should remove global keydown event listener on unmount", () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() =>
      useShortcut({ "Control+S": callback }),
    );

    unmount();

    expect(removeEventListenerMock).toHaveBeenCalledTimes(1);
    expect(removeEventListenerMock).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function),
    );
  });

  it("should throw an error for invalid modifier order", async () => {
    const callback = vi.fn();

    expect(() => {
      useShortcut({ "Shift+Control+S": callback });
    }).toThrow(
      'Invalid modifier order in shortcut "Shift+Control+S". Expected order: Control+Alt+Shift',
    );
  });

  it("should not throw an error for valid modifier order", () => {
    const callback = vi.fn();

    expect(() => {
      renderHook(() => useShortcut({ "Control+Alt+Shift+S": callback }));
    }).not.toThrow();
  });

  it("should handle multiple shortcuts", () => {
    // Restore original addEventListener to test actual functionality
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;

    const callback1 = vi.fn();
    const callback2 = vi.fn();

    renderHook(() =>
      useShortcut({
        "Control+S": callback1,
        "Control+Alt+D": callback2,
      }),
    );

    // Simulate Control+S keydown
    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "S",
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).not.toHaveBeenCalled();

    // Simulate Control+Alt+D keydown
    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "D",
        ctrlKey: true,
        altKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);

    // Restore mock
    window.addEventListener = addEventListenerMock;
    window.removeEventListener = removeEventListenerMock;
  });

  it("should not trigger callback for non-matching shortcuts", () => {
    // Restore original addEventListener to test actual functionality
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;

    const callback = vi.fn();

    renderHook(() =>
      useShortcut({
        "Control+S": callback,
      }),
    );

    // Simulate Control+A keydown (not registered)
    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "A",
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    expect(callback).not.toHaveBeenCalled();

    // Restore mock
    window.addEventListener = addEventListenerMock;
    window.removeEventListener = removeEventListenerMock;
  });

  it("should only add one global listener for multiple hook instances", () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    renderHook(() => useShortcut({ "Control+S": callback1 }));
    renderHook(() => useShortcut({ "Control+A": callback2 }));

    expect(addEventListenerMock).toHaveBeenCalledTimes(1);
  });

  it("should only remove global listener when all instances are unmounted", () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const hook1 = renderHook(() => useShortcut({ "Control+S": callback1 }));
    const hook2 = renderHook(() => useShortcut({ "Control+A": callback2 }));

    hook1.unmount();
    expect(removeEventListenerMock).not.toHaveBeenCalled();

    hook2.unmount();
    expect(removeEventListenerMock).toHaveBeenCalledTimes(1);
  });
});
