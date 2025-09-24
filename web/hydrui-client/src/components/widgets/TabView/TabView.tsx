import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/solid";
import React, { useEffect } from "react";

import PageView from "@/components/widgets/PageView/PageView";
import { Tab, useTabs } from "@/hooks/useTabs";
import { usePageStore } from "@/store/pageStore";

import "./index.css";

// TabView component to display and manage tabs
const TabView: React.FC = () => {
  const {
    activePageKey,
    selectedPageKeys,
    actions: { setPage, fetchPages, removeVirtualPage, setSelectedPageKeys },
  } = usePageStore();

  const tabs = useTabs();

  // Initial fetch of pages
  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const handleTabClick = async (tab: Tab, event: React.MouseEvent) => {
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
      await setPage(tab.key, tab.type);
    }
  };

  const handleCloseTab = async (
    tab: Tab,
    event?: React.MouseEvent | React.KeyboardEvent,
  ) => {
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
        // Try to switch to the tab to the left, otherwise take first remaining tab
        const prevIndex = Math.max(0, currentIndex - 1);
        const nextTab = remainingTabs[prevIndex] || remainingTabs[0];
        await setPage(nextTab.key, nextTab.type);
      }
    }
  };

  const handleTabKeyDown = async (tab: Tab, event: React.KeyboardEvent) => {
    const currentIndex = tabs.findIndex((t) => t.key === tab.key);

    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        if (currentIndex > 0) {
          const prevTab = tabs[currentIndex - 1];
          if (prevTab.key)
            document
              .querySelector<HTMLElement>(`[data-tab-key="${prevTab.key}"]`)
              ?.focus();
        }
        break;

      case "ArrowRight":
        event.preventDefault();
        if (currentIndex < tabs.length - 1) {
          const nextTab = tabs[currentIndex + 1];
          if (nextTab.key)
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
            const start = Math.min(currentIndex, lastSelectedIndex);
            const end = Math.max(currentIndex, lastSelectedIndex);

            const keysInRange = tabs.slice(start, end + 1).map((t) => t.key);
            setSelectedPageKeys([
              ...new Set([...selectedPageKeys, ...keysInRange]),
            ]);
          }
        } else {
          // Regular activation - select only this tab and make it active
          setSelectedPageKeys([tab.key]);
          await setPage(tab.key, tab.type);
        }
        break;

      case "Delete":
        event.preventDefault();
        if (tab.closeable) {
          await handleCloseTab(tab, event);
        }
        break;
    }
  };

  return (
    <div className="tab-view-container">
      {/* Tab bar */}
      <div className="tab-bar" role="tablist" aria-label="Page tabs">
        {tabs.map((tab) => (
          <div
            key={tab.key}
            data-tab-key={tab.key}
            className={`tab-item ${
              activePageKey === tab.key ? "tab-item-active" : ""
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
            onClick={(e) => handleTabClick(tab, e)}
            onKeyDown={(e) => handleTabKeyDown(tab, e)}
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
                onClick={(e) => handleCloseTab(tab, e)}
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
        id={`panel-${activePageKey}`}
        aria-labelledby={activePageKey || undefined}
      >
        {activePageKey ? (
          <PageView pageKey={activePageKey} />
        ) : (
          <div className="tab-empty-message">No page selected</div>
        )}
      </div>
    </div>
  );
};

export default TabView;
