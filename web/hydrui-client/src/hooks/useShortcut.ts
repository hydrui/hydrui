import { useEffect, useRef } from "react";

type ShortcutCallback = (e: KeyboardEvent) => void;

interface ShortcutMap {
  [key: string]: ShortcutCallback;
}

const globalShortcuts = new Map<ShortcutMap, boolean>();

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
  const keys: string[] = [];
  if (e.ctrlKey) keys.push("Control");
  if (e.altKey) keys.push("Alt");
  if (e.shiftKey) keys.push("Shift");
  if (e.key !== "Control" && e.key !== "Alt" && e.key !== "Shift") {
    keys.push(e.key);
  }
  const shortcutKey = keys.join("+");

  for (const [shortcuts] of globalShortcuts) {
    const callback = shortcuts[shortcutKey];
    if (callback) {
      callback(e);
    }
  }
};

export function useShortcut(shortcuts: ShortcutMap) {
  Object.keys(shortcuts).forEach(assertModifierOrder);

  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (globalShortcuts.size === 0) {
      window.addEventListener("keydown", globalKeydownHandler);
    }

    globalShortcuts.set(shortcutsRef.current, true);

    return () => {
      globalShortcuts.delete(shortcutsRef.current);

      if (globalShortcuts.size === 0) {
        window.removeEventListener("keydown", globalKeydownHandler);
      }
    };
  }, [shortcuts]);
}
