import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import { App } from "./App";
import "./index.css";
import { useToastStore } from "./store/toastStore";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

const intervalMS = 60 * 60 * 1000;
let updateToastId: string | undefined = undefined;

const updateSW = registerSW({
  onRegistered(r) {
    if (r) {
      setInterval(() => {
        r.update();
      }, intervalMS);
    }
  },
  onNeedRefresh() {
    if (updateToastId) {
      useToastStore.getState().actions.removeToast(updateToastId);
    }
    const toastId = (updateToastId = useToastStore
      .getState()
      .actions.addToast(
        "A new version of Hydrui is available. Would you like to update now? Please save any unsaved changes before updating.",
        "info",
        {
          duration: false,
          actions: [
            {
              label: "Update and Reload",
              variant: "primary",
              callback: () => {
                useToastStore.getState().actions.removeToast(toastId);
                updateToastId = undefined;
                updateSW();
              },
            },
            {
              label: "Ignore",
              variant: "secondary",
              callback: () => {
                useToastStore.getState().actions.removeToast(toastId);
                updateToastId = undefined;
              },
            },
          ],
        },
      ));
  },
  onOfflineReady() {
    useToastStore
      .getState()
      .actions.addToast(
        "Hydrui is now cached and can be used without an Internet connection.",
        "success",
      );
  },
});
