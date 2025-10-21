import {
  ArrowLeftEndOnRectangleIcon,
  Cog6ToothIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import AboutModal from "@/components/modals/AboutModal/AboutModal";
import DemoModal from "@/components/modals/DemoModal/DemoModal";
import SettingsModal from "@/components/modals/SettingsModal/SettingsModal";
import PopupPanel from "@/components/panels/PopupPanel/PopupPanel";
import ContextMenu from "@/components/widgets/Menu/ContextMenu";
import MenuBar from "@/components/widgets/Menu/MenuBar";
import Sidebar from "@/components/widgets/Sidebar/Sidebar";
import StatusBar from "@/components/widgets/StatusBar/StatusBar";
import TabView from "@/components/widgets/TabView/TabView";
import ToastContainer from "@/components/widgets/Toast/ToastContainer";
import { useApiActions } from "@/store/apiStore";
import { MenuBarMenu } from "@/store/contextMenuStore";
import { useUIStateActions, useUIStateStore } from "@/store/uiStateStore";
import { isDemoMode, isServerMode } from "@/utils/modes";

import "./index.css";

const SIDEBAR_MIN = 150;

const MainScreen = () => {
  const { setCredentials, setAuthenticated } = useApiActions();
  const { setSidebarHidden, setSidebarWidthPercent } = useUIStateActions();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(isDemoMode);
  const [sidebarWidth, setSidebarWidth] = useState({
    hidden: useUIStateStore.getState().sidebarHidden,
    percent: useUIStateStore.getState().sidebarWidthPercent,
    pixels: 0,
    lastX: -1,
  });
  setSidebarHidden(sidebarWidth.hidden);
  setSidebarWidthPercent(sidebarWidth.percent);
  const mainRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    setSidebarWidth((current) => {
      if (!mainRef.current) {
        return current;
      }
      event.preventDefault();
      event.stopPropagation();
      const movementX = event.pageX - current.lastX;
      if (current.hidden) {
        const clientLeft = mainRef.current.getBoundingClientRect().left;
        const pixels = event.pageX - clientLeft - 5;
        if (pixels > SIDEBAR_MIN) {
          return {
            ...current,
            hidden: false,
            percent: (pixels / mainRef.current.clientWidth) * 100,
            pixels,
            lastX: event.pageX,
          };
        } else {
          return current;
        }
      } else {
        const pixels = current.pixels + movementX;
        if (pixels < SIDEBAR_MIN) {
          return {
            ...current,
            hidden: true,
            lastX: event.pageX,
          };
        } else {
          return {
            ...current,
            percent: (pixels / mainRef.current.clientWidth) * 100,
            pixels,
            lastX: event.pageX,
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
      setSidebarWidth((current) => ({ ...current, lastX: event.pageX }));
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [handleMouseMove, handleMouseUp],
  );
  const handleDoubleClick = useCallback(() => {
    setSidebarWidth((value) => ({ ...value, hidden: !value.hidden }));
  }, []);

  useLayoutEffect(() => {
    const adjustSidebarWidth = () => {
      setSidebarWidth((current) => {
        if (!mainRef.current) {
          return current;
        }
        const pixels = (current.percent * mainRef.current.clientWidth) / 100;
        return {
          ...current,
          pixels: pixels < SIDEBAR_MIN ? SIDEBAR_MIN : pixels,
        };
      });
    };

    adjustSidebarWidth();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(adjustSidebarWidth);
      if (mainRef.current) {
        resizeObserver.observe(mainRef.current);
      }
    } else {
      window.addEventListener("resize", adjustSidebarWidth);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", adjustSidebarWidth);
      }
    };
  }, []);

  const menus: MenuBarMenu[] = [
    {
      label: "Hydrui",
      items: [
        {
          id: "settings",
          label: "Settings",
          icon: <Cog6ToothIcon />,
          onClick: () => setShowSettingsModal(true),
        },
        {
          id: "divider",
          label: "",
          divider: true,
        },
        {
          id: "logout",
          label: "Log out",
          icon: <ArrowLeftEndOnRectangleIcon />,
          onClick: async () => {
            setCredentials("", "");
            if (isServerMode) {
              await fetch("/logout", {
                method: "POST",
              });
            }
            setAuthenticated(false);
          },
        },
      ],
    },
    {
      label: "Help",
      items: [
        {
          id: "about",
          label: "About Hydrui",
          icon: <InformationCircleIcon />,
          onClick: () => setShowAboutModal(true),
        },
      ],
    },
  ];

  return (
    <div className="main-screen" ref={mainRef}>
      <MenuBar menus={menus} />
      <div className="main-screen-content">
        {sidebarWidth.hidden ? undefined : (
          <div
            className="main-screen-sidebar"
            style={{ width: sidebarWidth.pixels || `${sidebarWidth.percent}%` }}
          >
            <Sidebar />
          </div>
        )}
        <div className="main-screen-divider">
          <svg
            width="10"
            height="100%"
            viewBox="0 0 10 20"
            className="main-screen-divider-handle"
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
          >
            <circle cx="5" cy="2" r="2" fill="currentColor" opacity="0.4" />
            <circle cx="5" cy="8" r="2" fill="currentColor" opacity="0.4" />
            <circle cx="5" cy="14" r="2" fill="currentColor" opacity="0.4" />
          </svg>
        </div>
        <div className="main-screen-tab-view">
          <TabView />
        </div>
      </div>

      <div className="main-screen-status-bar">
        <StatusBar />
      </div>

      <PopupPanel />
      <ContextMenu />
      <ToastContainer />
      {showAboutModal && (
        <AboutModal onClose={() => setShowAboutModal(false)} />
      )}
      {showSettingsModal && (
        <SettingsModal onClose={() => setShowSettingsModal(false)} />
      )}
      {showDemoModal && <DemoModal onClose={() => setShowDemoModal(false)} />}
    </div>
  );
};

export default MainScreen;
