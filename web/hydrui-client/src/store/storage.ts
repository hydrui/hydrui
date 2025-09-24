import { createJSONStorage } from "zustand/middleware";

import { createDebouncedStorage } from "@/utils/debouncedStorage";

export const storage = createDebouncedStorage(localStorage);

export const jsonStorage = createJSONStorage(() => storage, {
  reviver: (_key, value) => {
    if (!value) {
      return value;
    }
    const type = (value as { $type: string })["$type"];
    switch (type) {
      case "set":
        return new Set((value as { $items: unknown[] })["$items"]);
      case "map":
        return new Map((value as { $items: [unknown, unknown][] })["$items"]);
    }
    return value;
  },
  replacer: (_key, value) => {
    if (value instanceof Set) {
      return { $type: "set", $items: Array.from(value) };
    } else if (value instanceof Map) {
      return { $type: "map", $items: Array.from(value) };
    }
    return value;
  },
});
