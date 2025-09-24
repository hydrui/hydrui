import React from "react";

import { ServiceType } from "@/constants/services";
import { FileRating as FileRatingType } from "@/hooks/useFileRatings";

import IncDecRating from "./IncDecRating";
import LikeRating from "./LikeRating";
import StarRating from "./StarRating";
import "./index.css";

export interface FileRatingProps {
  rating: FileRatingType;
  readOnly?: boolean;
  isLoading?: boolean;
  onChange?: (value: number | boolean | null) => void;
  className?: string;
}

const FileRating: React.FC<FileRatingProps> = ({
  rating,
  readOnly = true,
  isLoading = false,
  onChange,
}) => {
  switch (rating.serviceType) {
    case ServiceType.LOCAL_RATING_NUMERICAL:
    case ServiceType.RATING_NUMERICAL_REPOSITORY:
      return (
        <StarRating
          value={rating.value as number}
          maxStars={rating.maxStars || 5}
          starShape={rating.starShape}
          readOnly={readOnly}
          isLoading={isLoading}
          onChange={onChange}
        />
      );

    case ServiceType.LOCAL_RATING_LIKE:
    case ServiceType.RATING_LIKE_REPOSITORY:
      return (
        <LikeRating
          value={rating.value as boolean}
          readOnly={readOnly}
          isLoading={isLoading}
          onChange={onChange}
        />
      );

    case ServiceType.LOCAL_RATING_INCDEC:
      return (
        <IncDecRating
          value={rating.value as number}
          readOnly={readOnly}
          isLoading={isLoading}
          onChange={onChange}
        />
      );

    default:
      return null;
  }
};

export default FileRating;
