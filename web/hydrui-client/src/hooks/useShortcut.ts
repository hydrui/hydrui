import { useEffect, useRef } from "react";

type ShortcutCallback = (e: KeyboardEvent) => void;

interface ShortcutMap {
  [key: string]: ShortcutCallback | undefined;
}

let globalShortcuts: React.RefObject<ShortcutMap>[] = [];

const assertModifierOrder = (shortcutKey: string) => {
  const parts = shortcutKey.split("+");
  const modifiers = parts.slice(0, -1);

  let lastIndex = -1;
  for (const modifier of modifiers) {
    const index = ["Control", "Alt", "Shift"].indexOf(modifier);
    if (index <= lastIndex) {
      throw new Error(
        `Invalid modifier order in shortcut "${shortcutKey}". Expected order: Control+Alt+Shift`,
      );
    }
    lastIndex = index;
  }
};

const globalKeydownHandler = (e: KeyboardEvent) => {
  // Unfortunately there doesn't appear to be a good way to ignore events that
  // were handled by native widget implementations, so we'll just disable global
  // shortcuts when the focused element is certain input fields.
  if (e.target instanceof HTMLElement) {
    switch (e.target.tagName.toLowerCase()) {
      case "input":
      case "textarea":
      case "select":
        if (e.key === "Escape" && !e.ctrlKey && !e.altKey && !e.shiftKey) {
          // If pressing escape inside of an input box, leave it.
          e.target.blur();
        }
        return;
    }
  }

  const keys: string[] = [];
  if (e.ctrlKey) keys.push("Control");
  if (e.altKey) keys.push("Alt");
  if (e.shiftKey) keys.push("Shift");
  if (e.key !== "Control" && e.key !== "Alt" && e.key !== "Shift") {
    keys.push(e.key);
  }
  const shortcutKey = keys.join("+");

  for (const shortcuts of globalShortcuts) {
    const callback = shortcuts.current[shortcutKey];
    if (callback) {
      e.preventDefault();
      callback(e);
      return;
    }
  }
};

export function useShortcut(shortcuts: ShortcutMap) {
  Object.keys(shortcuts).forEach(assertModifierOrder);

  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (globalShortcuts.length === 0) {
      window.addEventListener("keydown", globalKeydownHandler);
    }

    globalShortcuts.unshift(shortcutsRef);

    return () => {
      globalShortcuts = globalShortcuts.filter((n) => n !== shortcutsRef);

      if (globalShortcuts.length === 0) {
        window.removeEventListener("keydown", globalKeydownHandler);
      }
    };
  }, []);
}
