import { create } from "zustand";

export type ToastType = "error" | "warning" | "info" | "success";
export type ToastProgress = number | "indeterminate";

const DEFAULT_TOAST_DURATION = 10000;

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number | false;
  createdAt: number;
  remainingTime: number | false;
  isPaused: boolean;
  progress?: ToastProgress | undefined;
  actions: ToastAction[];
}

interface ToastAction {
  label: string;
  callback: () => void;
  variant?: "primary" | "secondary" | "danger" | "muted";
}

interface ToastState {
  toasts: Toast[];
  actions: {
    addToast: (
      message: string,
      type: ToastType,
      options?: {
        duration?: number | false;
        actions?: ToastAction[];
        progress?: ToastProgress;
      },
    ) => string;
    removeToast: (id: string) => void;
    pauseToast: (id: string) => void;
    resumeToast: (id: string) => void;
    updateToastMessage: (id: string, message: string) => void;
    updateToastTime: (id: string, remainingTime: number) => void;
    updateToastProgress: (id: string, progress: ToastProgress) => void;
  };
}

export const useToastActions = () => useToastStore((state) => state.actions);

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  actions: {
    addToast: (
      message,
      type,
      { duration = DEFAULT_TOAST_DURATION, actions = [], progress } = {},
    ) => {
      const id = Math.random().toString(36).substring(2);
      set((state) => ({
        toasts: [
          ...state.toasts,
          {
            id,
            message,
            type,
            duration,
            actions,
            createdAt: Date.now(),
            remainingTime: duration,
            isPaused: false,
            ...(progress === undefined ? {} : { progress }),
          },
        ],
      }));
      return id;
    },

    removeToast: (id) => {
      set((state) => ({
        toasts: state.toasts.filter((toast) => toast.id !== id),
      }));
    },

    pauseToast: (id) => {
      set((state) => ({
        toasts: state.toasts.map((toast) =>
          toast.id === id ? { ...toast, isPaused: true } : toast,
        ),
      }));
    },

    resumeToast: (id) => {
      set((state) => ({
        toasts: state.toasts.map((toast) =>
          toast.id === id ? { ...toast, isPaused: false } : toast,
        ),
      }));
    },

    updateToastMessage: (id, message) => {
      set((state) => ({
        toasts: state.toasts.map((toast) =>
          toast.id === id ? { ...toast, message } : toast,
        ),
      }));
    },

    updateToastTime: (id, remainingTime) => {
      set((state) => ({
        toasts: state.toasts.map((toast) =>
          toast.id === id ? { ...toast, remainingTime } : toast,
        ),
      }));
    },

    updateToastProgress: (id, progress) => {
      set((state) => ({
        toasts: state.toasts.map((toast) =>
          toast.id === id ? { ...toast, progress } : toast,
        ),
      }));
    },
  },
}));
