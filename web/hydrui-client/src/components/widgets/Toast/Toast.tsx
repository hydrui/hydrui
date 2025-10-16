import { XMarkIcon } from "@heroicons/react/24/solid";
import React, { useEffect, useRef } from "react";

import PushButton from "@/components/widgets/PushButton/PushButton";
import {
  Toast as ToastType,
  ToastType as ToastVariant,
} from "@/store/toastStore";

import "./index.css";

const ANIMATION_INTERVAL = 100;

const getToastClass = (type: ToastVariant) => {
  switch (type) {
    case "error":
      return "toast-error";
    case "warning":
      return "toast-warning";
    case "info":
      return "toast-info";
    case "success":
      return "toast-success";
  }
};

const getProgressBarClass = (type: ToastVariant) => {
  switch (type) {
    case "error":
      return "toast-progress-bar-error";
    case "warning":
      return "toast-progress-bar-warning";
    case "info":
      return "toast-progress-bar-info";
    case "success":
      return "toast-progress-bar-success";
  }
};

interface ToastProps {
  toast: ToastType;
  onRemove: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onTimeUpdate: (id: string, remainingTime: number) => void;
}

export const Toast: React.FC<ToastProps> = ({
  toast,
  onRemove,
  onPause,
  onResume,
  onTimeUpdate,
}) => {
  const progressTimerRef = useRef<number | undefined>(undefined);
  const lastUpdateRef = useRef<number>(Date.now());

  // Handle progress updates
  useEffect(() => {
    if (!toast.duration) return;

    const updateProgress = () => {
      const now = Date.now();
      const elapsed = toast.isPaused ? 0 : now - lastUpdateRef.current;
      lastUpdateRef.current = now;

      const newRemainingTime = Math.max(
        0,
        (toast.remainingTime || 0) - elapsed,
      );
      onTimeUpdate(toast.id, newRemainingTime);

      if (newRemainingTime <= 0) {
        onRemove(toast.id);
        return;
      }

      progressTimerRef.current = window.setTimeout(
        updateProgress,
        ANIMATION_INTERVAL,
      );
    };

    progressTimerRef.current = window.setTimeout(
      updateProgress,
      ANIMATION_INTERVAL,
    );

    return () => {
      if (progressTimerRef.current) {
        window.clearTimeout(progressTimerRef.current);
      }
    };
  }, [
    toast.id,
    toast.duration,
    toast.isPaused,
    toast.remainingTime,
    onTimeUpdate,
    onRemove,
  ]);

  const progress =
    toast.duration && toast.remainingTime
      ? (toast.remainingTime / toast.duration) * 100
      : 100;

  return (
    <div
      className={`toast ${getToastClass(toast.type)}`}
      onMouseEnter={() => onPause(toast.id)}
      onMouseLeave={() => onResume(toast.id)}
      role="alert"
    >
      <div className="toast-content">
        <div className="toast-message">{toast.message}</div>
        {toast.actions.length === 0 ? (
          <button
            onClick={() => onRemove(toast.id)}
            className="toast-close-button"
            aria-label="Close notification"
          >
            <XMarkIcon className="toast-close-icon" />
          </button>
        ) : null}
      </div>

      {/* Actions */}
      {toast.actions.length > 0 ? (
        <div className="toast-buttons">
          {toast.actions.map((action) => (
            <PushButton
              onClick={action.callback}
              variant={action.variant}
              key={action.label}
            >
              {action.label}
            </PushButton>
          ))}
        </div>
      ) : null}

      {/* Progress bar */}
      {toast.duration ? (
        <div className="toast-progress-container">
          <div
            className={`toast-progress-bar ${getProgressBarClass(toast.type)}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : toast.progress ? (
        <div className="toast-progress-container">
          <div
            className={`toast-progress-bar ${getProgressBarClass(toast.type)}`}
            style={{ width: `${toast.progress}%` }}
          />
        </div>
      ) : null}
    </div>
  );
};
