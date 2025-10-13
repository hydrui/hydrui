import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/solid";
import React, { useEffect, useState } from "react";

import PageView from "@/components/widgets/PageView/PageView";
import { Tab, useTabs } from "@/hooks/useTabs";
import { usePageActions, usePageStore } from "@/store/pageStore";

import "./index.css";

interface TabRowProps {
  tabs: Tab[];
}

function tabContainsKey(tab: Tab, key: string): boolean {
  return tab.key === key || tab.tabs.some((tab) => tabContainsKey(tab, key));
}

// TabRow handles a single row of tabs.
const TabRow: React.FC<TabRowProps> = ({ tabs }) => {
  const {
    activePageKey,
    selectedPageKeys,
    actions: { setPage, removeVirtualPage, setSelectedPageKeys },
  } = usePageStore();

  const [currentIndex, setCurrentIndex] = useState<number>(() =>
    activePageKey
      ? tabs.findIndex((tab) => tabContainsKey(tab, activePageKey))
      : -1,
  );

  useEffect(() => {
    if (currentIndex === -1 || !tabs[currentIndex]) {
      return;
    }
    if (!activePageKey) {
      setCurrentIndex(-1);
      return;
    }
    if (tabContainsKey(tabs[currentIndex], activePageKey)) {
      return;
    }
    setCurrentIndex(
      tabs.findIndex((tab) => tabContainsKey(tab, activePageKey)),
    );
  }, [tabs, currentIndex, activePageKey]);

  const setTab = async (index: number) => {
    if (!tabs[index]) {
      return;
    }
    // Don't bother doing anything if we're already in a sub tab of this one.
    if (
      activePageKey &&
      tabs[index].key != activePageKey &&
      tabContainsKey(tabs[index], activePageKey)
    ) {
      return;
    }
    setPage(tabs[index].key, tabs[index].type);
    setCurrentIndex(index);
  };

  const handleTabClick = async (index: number, event: React.MouseEvent) => {
    const tab = tabs[index];
    if (!tab) {
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      // Toggle selection with Ctrl/Cmd
      if (selectedPageKeys.includes(tab.key)) {
        setSelectedPageKeys(selectedPageKeys.filter((key) => key !== tab.key));
      } else {
        setSelectedPageKeys([...selectedPageKeys, tab.key]);
      }
    } else if (event.shiftKey && selectedPageKeys.length > 0) {
      // Shift-click to select a range
      const lastSelectedIndex = tabs.findIndex(
        (t) => t.key === selectedPageKeys[selectedPageKeys.length - 1],
      );

      if (lastSelectedIndex !== -1) {
        const currentIndex = tabs.findIndex((t) => t.key === tab.key);
        const start = Math.min(currentIndex, lastSelectedIndex);
        const end = Math.max(currentIndex, lastSelectedIndex);

        const keysInRange = tabs.slice(start, end + 1).map((t) => t.key);
        setSelectedPageKeys([
          ...new Set([...selectedPageKeys, ...keysInRange]),
        ]);
      }
    } else {
      // Regular click sets the active page
      await setTab(index);
    }
  };

  const handleCloseTab = async (
    index: number,
    event?: React.MouseEvent | React.KeyboardEvent,
  ) => {
    const tab = tabs[index];
    if (!tab) {
      return;
    }
    if (event) {
      event.stopPropagation();
    }

    const currentIndex = tabs.findIndex((t) => t.key === tab.key);

    // Don't allow closing non-closeable tabs
    if (!tab.closeable) {
      return;
    }

    // Remove from selected keys
    setSelectedPageKeys(selectedPageKeys.filter((key) => key !== tab.key));

    // TODO: logic specific to different page types should be consolidated elsewhere
    if (tab.type === "virtual") {
      removeVirtualPage(tab.key);
    }

    // If we closed the active tab, switch to another tab
    if (activePageKey === tab.key) {
      const remainingTabs = tabs.filter((t) => t.key !== tab.key);

      if (remainingTabs.length > 0) {
        // Try to switch to the tab to the left.
        await setTab(Math.max(0, currentIndex - 1));
      }
    }
  };

  const handleTabKeyDown = async (
    index: number,
    event: React.KeyboardEvent,
  ) => {
    const tab = tabs[index];
    if (!tab) {
      return;
    }

    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        if (index > 0) {
          const prevTab = tabs[index - 1];
          if (prevTab?.key)
            document
              .querySelector<HTMLElement>(`[data-tab-key="${prevTab.key}"]`)
              ?.focus();
        }
        break;

      case "ArrowRight":
        event.preventDefault();
        if (index < tabs.length - 1) {
          const nextTab = tabs[index + 1];
          if (nextTab?.key)
            document
              .querySelector<HTMLElement>(`[data-tab-key="${nextTab.key}"]`)
              ?.focus();
        }
        break;

      case "Enter":
      case " ":
        event.preventDefault();
        if (event.ctrlKey || event.metaKey) {
          // Toggle selection with Ctrl/Cmd
          if (selectedPageKeys.includes(tab.key)) {
            setSelectedPageKeys(
              selectedPageKeys.filter((key) => key !== tab.key),
            );
          } else {
            setSelectedPageKeys([...selectedPageKeys, tab.key]);
          }
        } else if (event.shiftKey && selectedPageKeys.length > 0) {
          // Shift selection - select range from last selected to current
          const lastSelectedIndex = tabs.findIndex(
            (t) => t.key === selectedPageKeys[selectedPageKeys.length - 1],
          );

          if (lastSelectedIndex !== -1) {
            const start = Math.min(index, lastSelectedIndex);
            const end = Math.max(index, lastSelectedIndex);

            const keysInRange = tabs.slice(start, end + 1).map((t) => t.key);
            setSelectedPageKeys([
              ...new Set([...selectedPageKeys, ...keysInRange]),
            ]);
          }
        } else {
          // Regular activation - select only this tab and make it active
          setSelectedPageKeys([tab.key]);
          await setTab(index);
        }
        break;

      case "Delete":
        event.preventDefault();
        if (tab.closeable) {
          await handleCloseTab(index, event);
        }
        break;
    }
  };

  return (
    <div className="tab-view-container">
      {/* Tab bar */}
      <div className="tab-bar" role="tablist" aria-label="Page tabs">
        {tabs.map((tab, index) => (
          <div
            key={tab.key}
            data-tab-key={tab.key}
            className={`tab-item ${
              currentIndex === index ? "tab-item-active" : ""
            } ${
              selectedPageKeys.includes(tab.key)
                ? "tab-item-selected"
                : "tab-item-normal"
            } ${
              tab.type === "virtual"
                ? "tab-item-virtual"
                : tab.type === "search"
                  ? "tab-item-search"
                  : "tab-item-standard"
            }`}
            role="tab"
            tabIndex={0}
            aria-selected={activePageKey === tab.key}
            aria-controls={`panel-${tab.key}`}
            onClick={(e) => handleTabClick(index, e)}
            onKeyDown={(e) => handleTabKeyDown(index, e)}
          >
            {tab.type === "search" && (
              <MagnifyingGlassIcon className="tab-item-icon" />
            )}
            <span className={tab.closeable ? "tab-item-label" : undefined}>
              {tab.type === "virtual" && (
                <span className="tab-virtual-indicator">[V]</span>
              )}
              {tab.name}
            </span>
            {tab.closeable && (
              <button
                className="tab-close-button"
                onClick={(e) => handleCloseTab(index, e)}
                aria-label={`Close ${tab.name} tab`}
                tabIndex={-1} // Exclude from tab sequence, accessible via delete key
              >
                <XMarkIcon className="tab-close-icon" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Content area */}
      <div
        className="tab-content"
        role="tabpanel"
        id={`panel-${currentIndex}`}
        aria-labelledby={activePageKey || undefined}
      >
        {currentIndex === -1 || !tabs[currentIndex] ? (
          <div className="tab-empty-message">No page selected</div>
        ) : tabs[currentIndex].tabs.length > 0 ? (
          <TabRow tabs={tabs[currentIndex].tabs} />
        ) : (
          <PageView pageKey={tabs[currentIndex].key} />
        )}
      </div>
    </div>
  );
};

// TabView component to display and manage tabs
const TabView: React.FC = () => {
  const { fetchPages } = usePageActions();

  const tabs = useTabs();

  // Initial fetch of pages
  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  return <TabRow tabs={tabs}></TabRow>;
};

export default TabView;
