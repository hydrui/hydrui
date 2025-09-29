import React, { forwardRef, useCallback, useEffect, useRef } from "react";

import { usePageStore } from "@/store/pageStore";
import { useUIStateActions } from "@/store/uiStateStore";

interface ScrollViewProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onMouseDown?: React.MouseEventHandler<HTMLDivElement>;
  onContextMenu?: React.MouseEventHandler<HTMLDivElement>;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
  loaded?: boolean;
}

const ScrollView = forwardRef<HTMLDivElement, ScrollViewProps>(
  (
    {
      children,
      className = "",
      style,
      onMouseDown,
      onContextMenu,
      onScroll,
      loaded = false,
    },
    ref,
  ) => {
    const { activePageKey } = usePageStore();
    const { setScrollPosition, getScrollPosition } = useUIStateActions();

    const innerRef = useRef<HTMLDivElement>(null);
    const userScrolledRef = useRef(false);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const setRefs = useCallback(
      (element: HTMLDivElement | null) => {
        innerRef.current = element;
        if (!ref) return;
        if (typeof ref === "function") {
          ref(element);
        } else {
          ref.current = element;
        }
      },
      [ref],
    );

    // Save scroll position when user scrolls
    const handleScroll = useCallback(
      (e: React.UIEvent<HTMLDivElement>) => {
        onScroll?.(e);

        if (!innerRef.current || !activePageKey) return;

        const maxScroll =
          innerRef.current.scrollHeight - innerRef.current.clientHeight;

        // If the viewport doesn't have any scroll area, don't save the scroll position.
        if (maxScroll === 0) {
          return;
        }

        // Calculate percentage scrolled (0 to 1)
        const scrollPercentage = innerRef.current.scrollTop / maxScroll;

        userScrolledRef.current = true;

        // Update scroll position percentage in store
        setScrollPosition(activePageKey, scrollPercentage);
      },
      [activePageKey, setScrollPosition, onScroll],
    );

    // Restore scroll position when the active tab changes
    useEffect(() => {
      if (!innerRef.current || !activePageKey || !loaded) return;
      userScrolledRef.current = false;

      const savedPercentage = getScrollPosition(activePageKey);
      if (savedPercentage > 0) {
        const maxScroll =
          innerRef.current.scrollHeight - innerRef.current.clientHeight;
        innerRef.current.scrollTop = savedPercentage * maxScroll;
      }

      return () => {
        // Cleanup on unmount or tab change
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect();
          resizeObserverRef.current = null;
        }
      };
    }, [activePageKey, getScrollPosition, loaded]);

    return (
      <div
        ref={setRefs}
        className={className}
        style={style}
        onScroll={handleScroll}
        onMouseDown={onMouseDown}
        onContextMenu={onContextMenu}
      >
        {children}
      </div>
    );
  },
);

ScrollView.displayName = "ScrollView";

export default ScrollView;
