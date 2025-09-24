import { useMemo } from "react";

import { FileMetadata } from "../api/types";
import { ServiceType } from "../constants/services";
import { useServicesStore } from "../store/servicesStore";

export type RatingValue = boolean | number | null;

export interface FileRating {
  serviceKey: string;
  serviceName: string;
  serviceType: ServiceType;
  value: RatingValue;
  minStars?: number;
  maxStars?: number;
  starShape?: "circle" | "fat star";
}

export function useFileRatings(file: FileMetadata | null) {
  const { services } = useServicesStore();

  const ratings = useMemo(() => {
    if (!file?.ratings) return [];

    const fileRatings: FileRating[] = [];

    // Process each rating in the file
    for (const [serviceKey, value] of Object.entries(file.ratings)) {
      const service = services[serviceKey];
      if (!service) continue; // Skip if service not found

      const rating: FileRating = {
        serviceKey,
        serviceName: service.name,
        serviceType: service.type,
        value,
      };

      // Add numerical rating properties
      if (
        service.type === ServiceType.LOCAL_RATING_NUMERICAL ||
        service.type === ServiceType.RATING_NUMERICAL_REPOSITORY
      ) {
        rating.minStars = service.min_stars;
        rating.maxStars = service.max_stars;
        rating.starShape = service.star_shape;
      }

      // Add like/dislike rating properties
      if (
        service.type === ServiceType.LOCAL_RATING_LIKE ||
        service.type === ServiceType.RATING_LIKE_REPOSITORY
      ) {
        rating.starShape = service.star_shape;
      }

      fileRatings.push(rating);
    }

    return fileRatings;
  }, [file?.ratings, services]);

  const numericalRatings = useMemo(
    () =>
      ratings.filter(
        (r) =>
          r.serviceType === ServiceType.LOCAL_RATING_NUMERICAL ||
          r.serviceType === ServiceType.RATING_NUMERICAL_REPOSITORY,
      ),
    [ratings],
  );

  const likeRatings = useMemo(
    () =>
      ratings.filter(
        (r) =>
          r.serviceType === ServiceType.LOCAL_RATING_LIKE ||
          r.serviceType === ServiceType.RATING_LIKE_REPOSITORY,
      ),
    [ratings],
  );

  const incDecRatings = useMemo(
    () =>
      ratings.filter((r) => r.serviceType === ServiceType.LOCAL_RATING_INCDEC),
    [ratings],
  );

  return {
    ratings,
    numericalRatings,
    likeRatings,
    incDecRatings,
    hasRatings: ratings.length > 0,
  };
}
