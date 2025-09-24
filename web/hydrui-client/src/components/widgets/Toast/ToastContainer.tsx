import React from "react";

import { useToastStore } from "@/store/toastStore";

import { Toast } from "./Toast";
import "./index.css";

const ToastContainer: React.FC = () => {
  const {
    actions: { removeToast, pauseToast, resumeToast, updateToastTime },
    toasts,
  } = useToastStore();

  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          onRemove={removeToast}
          onPause={pauseToast}
          onResume={resumeToast}
          onTimeUpdate={updateToastTime}
        />
      ))}
    </div>
  );
};

export default ToastContainer;
