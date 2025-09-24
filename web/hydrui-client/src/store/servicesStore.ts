import { create } from "zustand";

import { Service } from "@/api/types";
import {
  LOCAL_FILE_SERVICES,
  LOCAL_TAG_SERVICES,
  RATINGS_SERVICES,
  REPOSITORIES,
} from "@/constants/services";
import { client, useApiStore } from "@/store/apiStore";

interface ServicesState {
  services: Record<string, Service>;
  isLoading: boolean;
  error: string | null;

  // Service key sets by type
  repositoryServices: Set<string>;
  ratingServices: Set<string>;
  localFileServices: Set<string>;
  localTagServices: Set<string>;

  actions: {
    fetchServices: () => Promise<void>;
  };
}

export const useServicesActions = () =>
  useServicesStore((state) => state.actions);

export const useServices = () => useServicesStore((state) => state.services);

export const useServicesStore = create<ServicesState>((set) => ({
  services: {},
  isLoading: false,
  error: null,
  repositoryServices: new Set(),
  ratingServices: new Set(),
  localFileServices: new Set(),
  localTagServices: new Set(),

  actions: {
    fetchServices: async () => {
      set({ isLoading: true, error: null });

      try {
        const response = await client.getServices();
        const services = response.services;

        const repositoryServices = new Set<string>();
        const ratingServices = new Set<string>();
        const localFileServices = new Set<string>();
        const localTagServices = new Set<string>();

        for (const [key, service] of Object.entries(services)) {
          const typedService = service as Service;
          if (REPOSITORIES.has(typedService.type)) {
            repositoryServices.add(key);
          }
          if (RATINGS_SERVICES.has(typedService.type)) {
            ratingServices.add(key);
          }
          if (LOCAL_FILE_SERVICES.has(typedService.type)) {
            localFileServices.add(key);
          }
          if (LOCAL_TAG_SERVICES.has(typedService.type)) {
            localTagServices.add(key);
          }
        }

        set({
          services,
          repositoryServices,
          ratingServices,
          localFileServices,
          localTagServices,
          isLoading: false,
        });
      } catch (error) {
        set({
          error:
            error instanceof Error ? error.message : "Failed to fetch services",
          isLoading: false,
        });
      }
    },
  },
}));

// Initialize services when authenticated
const unsubscribe = useApiStore.subscribe((state) => {
  if (state.isAuthenticated) {
    useServicesStore.getState().actions.fetchServices();
    unsubscribe();
  }
});
