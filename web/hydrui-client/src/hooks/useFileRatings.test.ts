import { renderHook } from "@testing-library/react";
import { Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { FileMetadata } from "../api/types";
import { ServiceType } from "../constants/services";
import { useServicesStore } from "../store/servicesStore";
import { useFileRatings } from "./useFileRatings";

// Mock the services store
vi.mock("../store/servicesStore", () => ({
  useServicesStore: vi.fn(),
}));

describe("useFileRatings", () => {
  const mockServices = {
    "numerical-service": {
      name: "Numerical Rating",
      type: ServiceType.LOCAL_RATING_NUMERICAL,
      type_pretty: "local numerical rating service",
      star_shape: "fat star",
      min_stars: 1,
      max_stars: 5,
    },
    "like-service": {
      name: "Like Rating",
      type: ServiceType.LOCAL_RATING_LIKE,
      type_pretty: "local like/dislike rating service",
      star_shape: "circle",
    },
    "incdec-service": {
      name: "Inc/Dec Rating",
      type: ServiceType.LOCAL_RATING_INCDEC,
      type_pretty: "local inc/dec rating service",
    },
  };

  const mockFile: FileMetadata = {
    file_id: 1,
    hash: "test-hash",
    ratings: {
      "numerical-service": 4,
      "like-service": true,
      "incdec-service": 1,
    },
  };

  beforeEach(() => {
    (useServicesStore as unknown as Mock).mockReturnValue({
      services: mockServices,
    });
  });

  it("should return empty arrays when file is null", () => {
    const { result } = renderHook(() => useFileRatings(null));

    expect(result.current.ratings).toHaveLength(0);
    expect(result.current.numericalRatings).toHaveLength(0);
    expect(result.current.likeRatings).toHaveLength(0);
    expect(result.current.incDecRatings).toHaveLength(0);
    expect(result.current.hasRatings).toBe(false);
  });

  it("should return empty arrays when file has no ratings", () => {
    const { result } = renderHook(() =>
      useFileRatings({ file_id: 1, hash: "test" }),
    );

    expect(result.current.ratings).toHaveLength(0);
    expect(result.current.hasRatings).toBe(false);
  });

  it("should process all rating types correctly", () => {
    const { result } = renderHook(() => useFileRatings(mockFile));

    // Check total ratings
    expect(result.current.ratings).toHaveLength(3);
    expect(result.current.hasRatings).toBe(true);

    // Check numerical ratings
    expect(result.current.numericalRatings).toHaveLength(1);
    const numericalRating = result.current.numericalRatings[0];
    expect(numericalRating.value).toBe(4);
    expect(numericalRating.minStars).toBe(1);
    expect(numericalRating.maxStars).toBe(5);
    expect(numericalRating.starShape).toBe("fat star");

    // Check like ratings
    expect(result.current.likeRatings).toHaveLength(1);
    const likeRating = result.current.likeRatings[0];
    expect(likeRating.value).toBe(true);
    expect(likeRating.starShape).toBe("circle");

    // Check inc/dec ratings
    expect(result.current.incDecRatings).toHaveLength(1);
    const incDecRating = result.current.incDecRatings[0];
    expect(incDecRating.value).toBe(1);
  });

  it("should skip ratings with unknown service keys", () => {
    const fileWithUnknownService: FileMetadata = {
      file_id: 1,
      hash: "test-hash",
      ratings: {
        "unknown-service": 5,
        "numerical-service": 4,
      },
    };

    const { result } = renderHook(() => useFileRatings(fileWithUnknownService));

    expect(result.current.ratings).toHaveLength(1);
    expect(result.current.ratings[0].serviceKey).toBe("numerical-service");
  });
});
