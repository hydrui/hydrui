import { StateStorage } from "zustand/middleware";

export const createDebouncedStorage = (storage: StateStorage): StateStorage => {
  let timeout: NodeJS.Timeout | null = null;
  const pendingSetItem: Map<string, string> = new Map();

  // Save pending items before page unload
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
      if (pendingSetItem.size > 0) {
        for (const [key, value] of pendingSetItem.entries()) {
          storage.setItem(key, value);
        }
        pendingSetItem.clear();
      }
    });
  }

  return {
    getItem: (key) => {
      return storage.getItem(key);
    },
    setItem: (key, value) => {
      pendingSetItem.set(key, value);
      if (timeout) {
        return;
      }
      timeout = setTimeout(() => {
        timeout = null;
        for (const [key, value] of pendingSetItem.entries()) {
          storage.setItem(key, value);
        }
        pendingSetItem.clear();
      }, 10000);
    },
    removeItem: (key) => {
      if (pendingSetItem.has(key)) {
        pendingSetItem.delete(key);
      }
      storage.removeItem(key);
    },
  };
};
