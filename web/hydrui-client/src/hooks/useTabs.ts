import { useMemo } from "react";

import { usePageStore } from "../store/pageStore";
import { SEARCH_PAGE_KEY } from "../store/pageStore";

export interface Tab {
  key: string;
  name: string;
  type: "search" | "hydrus" | "virtual";
  closeable: boolean;
}

export function useTabs(): Tab[] {
  const { pages, virtualPages, virtualPageKeys } = usePageStore();

  return useMemo(() => {
    const tabs: Tab[] = [
      // Search tab is always first
      {
        key: SEARCH_PAGE_KEY,
        name: "Search",
        type: "search",
        closeable: false,
      },
      // Hydrus pages
      ...pages.map((page) => ({
        key: page.page_key,
        name: page.name,
        type: "hydrus" as const,
        closeable: true,
      })),
      // Virtual pages in their specified order
      ...virtualPageKeys.map((key) => ({
        key,
        name: virtualPages[key].name,
        type: "virtual" as const,
        closeable: true,
      })),
    ];

    return tabs;
  }, [pages, virtualPages, virtualPageKeys]);
}
