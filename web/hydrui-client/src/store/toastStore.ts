import { create } from "zustand";

export type ToastType = "error" | "warning" | "info" | "success";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  createdAt: number;
  remainingTime?: number;
  isPaused: boolean;
  progress?: number;
  cancelCallback?: () => void;
}

interface ToastState {
  toasts: Toast[];
  actions: {
    addToast: (
      message: string,
      type: ToastType,
      duration?: number,
      cancelCallback?: () => void,
    ) => string;
    removeToast: (id: string) => void;
    pauseToast: (id: string) => void;
    resumeToast: (id: string) => void;
    updateToastTime: (id: string, remainingTime: number) => void;
    updateToastProgress: (id: string, progress: number) => void;
  };
}

export const useToastActions = () => useToastStore((state) => state.actions);

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  actions: {
    addToast: (message, type, duration, cancelCallback) => {
      const id = Math.random().toString(36).substring(2);
      set((state) => ({
        toasts: [
          ...state.toasts,
          {
            id,
            message,
            type,
            duration,
            cancelCallback,
            createdAt: Date.now(),
            remainingTime: duration,
            isPaused: false,
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
