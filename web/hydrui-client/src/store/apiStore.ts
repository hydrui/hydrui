import { create } from "zustand";
import { persist } from "zustand/middleware";

import { HydrusClient } from "@/api/client";
import { MockHydrusClient } from "@/api/mockClient";
import { HydrusApiClient } from "@/api/types";
import { isServerMode } from "@/utils/serverMode";

// Create client instance based on environment
export const client =
  typeof process !== "undefined" && process.env.NODE_ENV === "test"
    ? new MockHydrusClient()
    : new HydrusClient();

interface ApiState {
  apiKey: string;
  baseUrl: string;
  checkingAuthentication: boolean;
  isAuthenticated: boolean;

  actions: {
    setCredentials: (apiKey: string, baseUrl: string) => void;
    setCheckingAuthentication: (checkingAuthentication: boolean) => void;
    setAuthenticated: (isAuthenticated: boolean) => void;
  };
}

// Helper function to test authentication
export const verifyAuthentication = async (
  client: HydrusApiClient,
  apiKey: string,
  baseUrl: string,
): Promise<boolean> => {
  try {
    if (client instanceof HydrusClient) {
      client.setBaseUrl(baseUrl);
    }

    const isValid = await client.verifyAccessKey(apiKey);
    if (isValid) {
      if (
        client instanceof HydrusClient ||
        client instanceof MockHydrusClient
      ) {
        client.setApiKey(apiKey);
      }
      return true;
    }
  } catch (error) {
    console.error("Failed to verify API key:", error);
  }
  return false;
};

export const useApiActions = () => useApiStore((state) => state.actions);

export const useApiStore = create<ApiState>()(
  persist(
    (set) => ({
      apiKey: "",
      baseUrl: "http://localhost:45869",
      isAuthenticated: false,
      checkingAuthentication: false,

      actions: {
        setCredentials: (apiKey: string, baseUrl: string) => {
          set({ apiKey, baseUrl });
        },

        setCheckingAuthentication: (checkingAuthentication: boolean) => {
          set({ checkingAuthentication });
        },

        setAuthenticated: (isAuthenticated: boolean) => {
          if (isAuthenticated) {
            set({ isAuthenticated, checkingAuthentication: false });
          } else {
            set({
              apiKey: "",
              isAuthenticated: false,
              checkingAuthentication: false,
            });
          }
        },
      },
    }),
    {
      name: "hydrui-api",
      partialize: (state) => ({
        apiKey: state.apiKey,
        baseUrl: state.baseUrl,
      }),
      onRehydrateStorage: () => async (state) => {
        // Verify stored credentials on rehydration
        if (state?.apiKey && !isServerMode) {
          state.actions.setCheckingAuthentication(true);
          state.actions.setAuthenticated(
            await verifyAuthentication(client, state.apiKey, state.baseUrl),
          );
        }
      },
    },
  ),
);

async function verifyServerAuthentication() {
  const {
    actions: { setCheckingAuthentication, setAuthenticated },
  } = useApiStore.getState();
  setCheckingAuthentication(true);
  setAuthenticated(await verifyAuthentication(client, "", ""));
}

if (isServerMode) {
  verifyServerAuthentication().catch(console.error);
}
