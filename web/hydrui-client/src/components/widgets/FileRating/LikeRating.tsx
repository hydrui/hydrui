import { HeartIcon as HeartOutlineIcon } from "@heroicons/react/24/outline";
import { HeartIcon } from "@heroicons/react/24/solid";
import React from "react";

import "./index.css";

interface LikeRatingProps {
  value: boolean | null;
  readOnly?: boolean;
  isLoading?: boolean;
  onChange?: (value: boolean | null) => void;
}

const LikeRating: React.FC<LikeRatingProps> = ({
  value,
  readOnly = true,
  isLoading = false,
  onChange,
}) => {
  const handleClick = () => {
    if (readOnly || !onChange || isLoading) return;
    // Toggle between true/false/null
    if (value === null) {
      onChange(true);
    } else if (value === true) {
      onChange(false);
    } else {
      onChange(null);
    }
  };

  const getLikeState = () => {
    if (value === null) return "null";
    if (value === true) return "liked";
    return "disliked";
  };

  return (
    <button
      onClick={handleClick}
      className={`rating-button like-rating-button ${getLikeState()} ${readOnly ? "readonly" : ""} ${isLoading ? "loading" : ""}`}
      disabled={readOnly || isLoading}
      aria-label={value === null ? "Not rated" : value ? "Liked" : "Disliked"}
    >
      {value === null ? (
        <HeartOutlineIcon className="rating-icon" />
      ) : (
        <HeartIcon className="rating-icon" />
      )}
      {isLoading && (
        <div className="rating-loading-spinner">
          <div className="rating-spinner"></div>
        </div>
      )}
    </button>
  );
};

export default LikeRating;
