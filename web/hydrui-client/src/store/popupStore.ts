import { create } from "zustand";
import { persist } from "zustand/middleware";

import { JobStatus } from "@/api/types";
import { client } from "@/store/apiStore";
import { jsonStorage } from "@/store/storage";

interface PopupState {
  jobs: JobStatus[];
  isCollapsed: boolean;
  hasUnread: boolean;
  error: string | null;
  lastUpdateTimestamp: number;
  pollingInterval: number | null;

  actions: {
    setJobs: (jobs: JobStatus[]) => void;
    setCollapsed: (collapsed: boolean) => void;
    setHasUnread: (hasUnread: boolean) => void;
    setError: (error: string | null) => void;
    dismissJob: (jobKey: string) => Promise<void>;
    fetchJobs: () => Promise<void>;
    startPolling: () => void;
    stopPolling: () => void;
  };
}

export const usePopupActions = () => usePopupStore((state) => state.actions);

export const usePopupStore = create<PopupState>()(
  persist(
    (set, get) => ({
      jobs: [],
      isCollapsed: true,
      hasUnread: false,
      error: null,
      lastUpdateTimestamp: 0,
      pollingInterval: null,

      actions: {
        setJobs: (jobs) => set({ jobs }),
        setCollapsed: (isCollapsed) => set({ isCollapsed }),
        setHasUnread: (hasUnread) => set({ hasUnread }),
        setError: (error) => set({ error }),

        dismissJob: async (jobKey: string) => {
          try {
            await client.dismissPopup(jobKey);
            set((state) => ({
              jobs: state.jobs.filter((job) => job.key !== jobKey),
            }));
          } catch (error) {
            console.error("Failed to dismiss popup:", error);
          }
        },

        fetchJobs: async () => {
          try {
            const response = await client.getPopups();
            set((state) => {
              // Check if we have any new items
              const latestTimestamp = Math.trunc(
                Math.max(
                  ...response.job_statuses.map((j) => j.creation_time),
                  0, // Fallback for empty array
                ),
              );

              if (latestTimestamp > state.lastUpdateTimestamp) {
                return {
                  jobs: response.job_statuses,
                  error: null,
                  lastUpdateTimestamp: latestTimestamp,
                  hasUnread: true,
                };
              }

              return {
                jobs: response.job_statuses,
                error: null,
                lastUpdateTimestamp: latestTimestamp,
              };
            });
          } catch (error) {
            console.error("Failed to fetch popups:", error);
            set({ error: "Failed to fetch updates from Hydrus" });
          }
        },

        startPolling: () => {
          const state = get();

          // Clear any existing interval
          if (state.pollingInterval !== null) {
            window.clearInterval(state.pollingInterval);
          }

          // Start new polling interval
          const intervalId = window.setInterval(() => {
            get().actions.fetchJobs();
          }, 30000); // Every 30 seconds

          set({ pollingInterval: intervalId });
        },

        stopPolling: () => {
          const state = get();
          if (state.pollingInterval !== null) {
            window.clearInterval(state.pollingInterval);
            set({ pollingInterval: null });
          }
        },
      },
    }),
    {
      name: "hydrui-popup-state",
      storage: jsonStorage,
      // Only persist specific keys
      partialize: (state) => ({
        lastUpdateTimestamp: state.lastUpdateTimestamp,
        isCollapsed: state.isCollapsed,
        hasUnread: state.hasUnread,
      }),
    },
  ),
);

// Handle visibility changes for polling
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      // Immediately fetch when becoming visible
      usePopupStore.getState().actions.fetchJobs();
      usePopupStore.getState().actions.startPolling();
    } else {
      usePopupStore.getState().actions.stopPolling();
    }
  });
}
