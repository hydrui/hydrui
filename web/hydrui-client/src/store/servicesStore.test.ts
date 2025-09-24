import { beforeEach, describe, expect, it, vi } from "vitest";

import { Service } from "@/api/types";

import { ServiceType } from "../constants/services";
import { client, useApiStore } from "./apiStore";
import { useServicesStore } from "./servicesStore";

// Mock example services response
const mockServices: Record<string, Service> = {
  c6f63616c2074616773: {
    name: "my tags",
    type: ServiceType.LOCAL_TAG,
    type_pretty: "local tag service",
  },
  "5674450950748cfb28778b511024cfbf0f9f67355cf833de632244078b5a6f8d": {
    name: "example tag repo",
    type: ServiceType.TAG_REPOSITORY,
    type_pretty: "hydrus tag repository",
  },
  "6c6f63616c2066696c6573": {
    name: "my files",
    type: ServiceType.LOCAL_FILE_DOMAIN,
    type_pretty: "local file domain",
  },
  "7265706f7369746f72792075706461746573": {
    name: "repository updates",
    type: ServiceType.LOCAL_FILE_UPDATE_DOMAIN,
    type_pretty: "local update file domain",
  },
  ae7d9a603008919612894fc360130ae3d9925b8577d075cd0473090ac38b12b6: {
    name: "example file repo",
    type: ServiceType.FILE_REPOSITORY,
    type_pretty: "hydrus file repository",
  },
  "74d52c6238d25f846d579174c11856b1aaccdb04a185cb2c79f0d0e499284f2c": {
    name: "example local rating like service",
    type: ServiceType.LOCAL_RATING_LIKE,
    type_pretty: "local like/dislike rating service",
    star_shape: "circle",
  },
};

describe("servicesStore", () => {
  beforeEach(() => {
    // Reset store state
    useServicesStore.setState({
      services: {},
      isLoading: false,
      error: null,
      repositoryServices: new Set(),
      ratingServices: new Set(),
      localFileServices: new Set(),
      localTagServices: new Set(),
    });

    // Mock API client
    vi.spyOn(client, "getServices").mockResolvedValue({
      version: 1,
      hydrus_version: 1,
      services: mockServices,
    });
    useApiStore.setState({ isAuthenticated: true });
  });

  it("should fetch and categorize services", async () => {
    await useServicesStore.getState().actions.fetchServices();
    const state = useServicesStore.getState();

    // Check services are stored
    expect(state.services).toEqual(mockServices);

    // Check service categorization
    expect(state.repositoryServices.size).toBe(2); // tag and file repos
    expect(state.ratingServices.size).toBe(1); // like rating service
    expect(state.localFileServices.size).toBe(2); // local files and updates
    expect(state.localTagServices.size).toBe(1); // local tags

    // Check specific service keys
    expect(
      state.repositoryServices.has(
        "5674450950748cfb28778b511024cfbf0f9f67355cf833de632244078b5a6f8d",
      ),
    ).toBe(true);
    expect(
      state.repositoryServices.has(
        "ae7d9a603008919612894fc360130ae3d9925b8577d075cd0473090ac38b12b6",
      ),
    ).toBe(true);
  });

  it("should store service by key", async () => {
    await useServicesStore.getState().actions.fetchServices();

    const service = useServicesStore.getState().services["c6f63616c2074616773"];
    expect(service).toBeDefined();
    expect(service?.name).toBe("my tags");
    expect(service?.type).toBe(ServiceType.LOCAL_TAG);
  });

  it("should handle errors", async () => {
    const error = new Error("API Error");
    vi.spyOn(client, "getServices").mockRejectedValue(error);

    await useServicesStore.getState().actions.fetchServices();
    const state = useServicesStore.getState();

    expect(state.error).toBe("API Error");
    expect(state.isLoading).toBe(false);
  });
});
