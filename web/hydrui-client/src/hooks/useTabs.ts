import { useMemo } from "react";

import { Page } from "@/api/types";

import { usePageStore } from "../store/pageStore";
import { SEARCH_PAGE_KEY } from "../store/pageStore";

export interface Tab {
  key: string;
  name: string;
  type: "search" | "hydrus" | "virtual";
  closeable: boolean;
  tabs: Tab[];
}

function hydrusPageToTab(page: Page): Tab {
  return {
    key: page.page_key,
    name: page.name,
    type: "hydrus" as const,
    closeable: true,
    tabs: (page.pages ?? []).map(hydrusPageToTab),
  };
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
        tabs: [],
      },
      // Hydrus pages
      ...pages.map(hydrusPageToTab),
      // Virtual pages in their specified order
      ...virtualPageKeys.map((key) => ({
        key,
        name: virtualPages[key].name,
        type: "virtual" as const,
        closeable: true,
        tabs: [],
      })),
    ];

    return tabs;
  }, [pages, virtualPages, virtualPageKeys]);
}
