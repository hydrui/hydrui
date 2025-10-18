import {
  ArrowLeftEndOnRectangleIcon,
  Cog6ToothIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

import AboutModal from "@/components/modals/AboutModal/AboutModal";
import SettingsModal from "@/components/modals/SettingsModal/SettingsModal";
import PopupPanel from "@/components/panels/PopupPanel/PopupPanel";
import ContextMenu from "@/components/widgets/Menu/ContextMenu";
import MenuBar from "@/components/widgets/Menu/MenuBar";
import Sidebar from "@/components/widgets/Sidebar/Sidebar";
import StatusBar from "@/components/widgets/StatusBar/StatusBar";
import TabView from "@/components/widgets/TabView/TabView";
import ToastContainer from "@/components/widgets/Toast/ToastContainer";
import { useApiStore } from "@/store/apiStore";
import { MenuBarMenu } from "@/store/contextMenuStore";
import { isServerMode } from "@/utils/modes";

import "./index.css";

const MainScreen = () => {
  const {
    actions: { setCredentials, setAuthenticated },
  } = useApiStore();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);

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

  // Otherwise, show the main application
  return (
    <div className="main-screen">
      <MenuBar menus={menus} />
      <div className="main-screen-content">
        <div className="main-screen-sidebar">
          <Sidebar />
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
    </div>
  );
};

export default MainScreen;
