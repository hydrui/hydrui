import { useCallback, useLayoutEffect, useRef, useState } from "react";

import FilePreview from "@/components/widgets/FilePreview/FilePreview";
import TagList from "@/components/widgets/TagList/TagList";
import { useUIStateActions, useUIStateStore } from "@/store/uiStateStore";

import "./index.css";

const TAGS_MIN = 100;
const PREVIEW_MIN = 100;

function Sidebar() {
  const { setTagListHidden, setPreviewHidden, setTagListHeightPercent } =
    useUIStateActions();
  const [tagsHeight, setTagsHeight] = useState({
    tagsHidden: useUIStateStore.getState().tagListHidden,
    previewHidden: useUIStateStore.getState().previewHidden,
    percent: useUIStateStore.getState().tagListHeightPercent,
    pixels: 0,
    lastY: -1,
  });
  setTagListHidden(tagsHeight.tagsHidden);
  setPreviewHidden(tagsHeight.previewHidden);
  setTagListHeightPercent(tagsHeight.percent);
  const mainRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    setTagsHeight((current) => {
      if (!mainRef.current) {
        return current;
      }
      event.preventDefault();
      event.stopPropagation();
      const movementY = event.pageY - current.lastY;
      const clientTop = mainRef.current.getBoundingClientRect().top;
      if (current.tagsHidden) {
        const pixels = event.pageY - clientTop - 5;
        if (pixels > TAGS_MIN) {
          return {
            ...current,
            tagsHidden: false,
            percent: (pixels / mainRef.current.clientHeight) * 100,
            pixels,
            lastY: event.pageY,
          };
        } else {
          return current;
        }
      } else if (current.previewHidden) {
        const pixels = event.pageY - clientTop - 5;
        if (mainRef.current.clientHeight - pixels - 12 > PREVIEW_MIN) {
          return {
            ...current,
            previewHidden: false,
            percent: (pixels / mainRef.current.clientHeight) * 100,
            pixels,
            lastY: event.pageY,
          };
        } else {
          return current;
        }
      } else {
        const pixels = current.pixels + movementY;
        if (pixels < TAGS_MIN) {
          return {
            ...current,
            tagsHidden: true,
            previewHidden: false,
            lastY: event.pageY,
          };
        } else if (mainRef.current.clientHeight - pixels - 12 < PREVIEW_MIN) {
          return {
            ...current,
            tagsHidden: false,
            previewHidden: true,
            pixels: 0,
            percent: 100,
            lastY: event.pageY,
          };
        } else {
          return {
            ...current,
            previewHidden: false,
            percent: (pixels / mainRef.current.clientHeight) * 100,
            pixels,
            lastY: event.pageY,
          };
        }
      }
    });
  }, []);
  const handleMouseUp = useCallback(() => {
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);
  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setTagsHeight((current) => ({ ...current, lastY: event.pageY }));
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [handleMouseMove, handleMouseUp],
  );
  const handleDoubleClick = useCallback(() => {
    setTagsHeight((value) => ({ ...value, tagsHidden: !value.tagsHidden }));
  }, []);

  useLayoutEffect(() => {
    const adjustTagsHeight = () => {
      setTagsHeight((current) => {
        if (!mainRef.current) {
          return current;
        }
        const pixels = (current.percent * mainRef.current.clientHeight) / 100;
        return {
          ...current,
          pixels: pixels < TAGS_MIN ? TAGS_MIN : pixels,
        };
      });
    };

    adjustTagsHeight();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(adjustTagsHeight);
      if (mainRef.current) {
        resizeObserver.observe(mainRef.current);
      }
    } else {
      window.addEventListener("resize", adjustTagsHeight);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", adjustTagsHeight);
      }
    };
  }, []);

  return (
    <div className="sidebar-container" ref={mainRef}>
      {tagsHeight.tagsHidden ? undefined : (
        <TagList
          style={
            tagsHeight.previewHidden
              ? { height: "calc(100% - 12px)" }
              : { height: tagsHeight.pixels || `${tagsHeight.percent}%` }
          }
        />
      )}
      <div
        className="sidebar-divider"
        style={
          tagsHeight.tagsHidden
            ? { borderTop: "none" }
            : tagsHeight.previewHidden
              ? { borderBottom: "none" }
              : undefined
        }
      >
        <svg
          height="10"
          width="100%"
          viewBox="0 0 20 10"
          className="sidebar-divider-handle"
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
        >
          <circle cx="2" cy="5" r="2" fill="currentColor" opacity="0.4" />
          <circle cx="8" cy="5" r="2" fill="currentColor" opacity="0.4" />
          <circle cx="14" cy="5" r="2" fill="currentColor" opacity="0.4" />
        </svg>
      </div>
      {tagsHeight.previewHidden ? undefined : <FilePreview />}
    </div>
  );
}

export default Sidebar;
