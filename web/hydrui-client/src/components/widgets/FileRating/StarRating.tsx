import {
  PlusCircleIcon as PlusCircleOutlineIcon,
  StarIcon as StarOutlineIcon,
} from "@heroicons/react/24/outline";
import { PlusCircleIcon, StarIcon } from "@heroicons/react/24/solid";
import React, { useState } from "react";

import "./index.css";

interface StarRatingProps {
  value: number | null;
  maxStars: number;
  starShape?: "circle" | "fat star" | undefined;
  readOnly?: boolean;
  isLoading?: boolean;
  onChange?: ((value: number | null) => void) | undefined;
}

const StarRating: React.FC<StarRatingProps> = ({
  value,
  maxStars,
  starShape = "fat star",
  readOnly = true,
  isLoading = false,
  onChange,
}) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const [loadingValue, setLoadingValue] = useState<number | null>(null);

  const handleStarClick = (rating: number) => {
    if (readOnly || !onChange || isLoading) return;
    setHoverValue(null);
    setLoadingValue(rating);
    // If clicking the same rating, clear it
    onChange(rating === value ? null : rating);
  };

  const handleStarHover = (rating: number | null) => {
    if (readOnly || isLoading) return;
    setHoverValue(rating);
  };

  const displayValue = isLoading
    ? (loadingValue ?? 0)
    : (hoverValue ?? value ?? 0);

  const SolidIcon = starShape === "circle" ? PlusCircleIcon : StarIcon;
  const OutlineIcon =
    starShape === "circle" ? PlusCircleOutlineIcon : StarOutlineIcon;

  return (
    <div className="star-rating-container">
      {Array.from({ length: maxStars }, (_, i) => i + 1).map((rating) => (
        <button
          key={rating}
          onClick={() => handleStarClick(rating)}
          onMouseEnter={() => handleStarHover(rating)}
          onMouseLeave={() => handleStarHover(null)}
          className={`rating-button star-rating-star ${hoverValue !== null ? "star-rating-hover" : ""} ${readOnly ? "readonly" : ""} ${isLoading ? "loading" : ""} ${rating <= displayValue ? "active" : "inactive"}`}
          disabled={readOnly || isLoading}
          aria-label={`Rate ${rating} out of ${maxStars} stars`}
        >
          {rating <= displayValue ? (
            <SolidIcon className="rating-icon" />
          ) : (
            <OutlineIcon className="rating-icon" />
          )}
          {isLoading && rating === value && (
            <div className="rating-loading-spinner">
              <div className="rating-spinner"></div>
            </div>
          )}
        </button>
      ))}
      <span className="star-rating-value">
        {displayValue || "—"}/{maxStars}
      </span>
    </div>
  );
};

export default StarRating;
