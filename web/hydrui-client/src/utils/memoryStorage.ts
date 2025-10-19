import { StateStorage } from "zustand/middleware";

export const createMemoryStorage = (): StateStorage => {
  const storage: Map<string, string> = new Map();
  return {
    getItem: (key) => {
      return storage.get(key) ?? null;
    },
    setItem: (key, value) => {
      storage.set(key, value);
    },
    removeItem: (key) => {
      storage.delete(key);
    },
  };
};
