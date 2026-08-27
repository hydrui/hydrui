import { Page } from "@/api/types";

// Special page key for our search tab - this will never conflict with API page keys.
export const SEARCH_PAGE_KEY = "hydrui-search-tab";

export type ResolvedPageType = "search" | "hydrus" | "virtual";

export interface HydrusPageOption {
  key: string;
  label: string;
}

export interface ResolvedStartupPage {
  pageKey: string;
  pageType: ResolvedPageType;
}

export function isSelectableHydrusPage(page: Page): boolean {
  return (page.pages?.length ?? 0) === 0 && page.is_media_page !== false;
}

export function hasSelectableHydrusPage(
  pages: Page[],
  pageKey: string,
): boolean {
  return pages.some(
    (page) =>
      (page.page_key === pageKey && isSelectableHydrusPage(page)) ||
      hasSelectableHydrusPage(page.pages ?? [], pageKey),
  );
}

export function flattenHydrusPages(
  pages: Page[],
  parentNames: string[] = [],
): HydrusPageOption[] {
  return pages.flatMap((page) => {
    const names = [...parentNames, page.name];
    return [
      ...(isSelectableHydrusPage(page)
        ? [{ key: page.page_key, label: names.join(" › ") }]
        : []),
      ...flattenHydrusPages(page.pages ?? [], names),
    ];
  });
}

export function resolveStartupPage({
  startupPageKey,
  lastPageKey,
  lastPageType,
  pages,
  virtualPageKeys,
}: {
  // Null means to restore the last page.
  startupPageKey: string | null;
  lastPageKey: string | null;
  lastPageType: ResolvedPageType;
  pages: Page[];
  virtualPageKeys: string[];
}): ResolvedStartupPage {
  const resolvePageKey = (
    pageKey: string | null,
    pageType: ResolvedPageType,
  ): ResolvedStartupPage | null => {
    if (pageKey === SEARCH_PAGE_KEY) {
      return { pageKey: SEARCH_PAGE_KEY, pageType: "search" };
    }
    if (
      pageKey &&
      pageType === "hydrus" &&
      hasSelectableHydrusPage(pages, pageKey)
    ) {
      return { pageKey, pageType: "hydrus" };
    }
    if (
      pageKey &&
      pageType === "virtual" &&
      virtualPageKeys.includes(pageKey)
    ) {
      return { pageKey, pageType: "virtual" };
    }
    return null;
  };

  if (startupPageKey !== null) {
    return (
      resolvePageKey(startupPageKey, "hydrus") ?? {
        pageKey: SEARCH_PAGE_KEY,
        pageType: "search",
      }
    );
  }

  return (
    resolvePageKey(lastPageKey, lastPageType) ?? {
      pageKey: SEARCH_PAGE_KEY,
      pageType: "search",
    }
  );
}
