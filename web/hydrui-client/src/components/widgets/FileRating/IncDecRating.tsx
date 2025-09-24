import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/solid";
import React from "react";

import "./index.css";

interface IncDecRatingProps {
  value: number | null;
  readOnly?: boolean;
  isLoading?: boolean;
  onChange?: (value: number | null) => void;
}

const IncDecRating: React.FC<IncDecRatingProps> = ({
  value,
  readOnly = true,
  isLoading = false,
  onChange,
}) => {
  const handleClick = (increment: boolean) => {
    if (readOnly || !onChange || isLoading) return;

    if (value === null) {
      onChange(increment ? 1 : -1);
    } else if (increment && value < 1) {
      onChange(value + 1);
    } else if (!increment && value > -1) {
      onChange(value - 1);
    } else {
      onChange(null);
    }
  };

  const getValueClass = () => {
    if (value === null) return "neutral";
    if (value > 0) return "positive";
    if (value < 0) return "negative";
    return "neutral";
  };

  return (
    <div className="incdec-rating-container">
      <button
        onClick={() => handleClick(true)}
        className={`rating-button incdec-rating-button-up ${readOnly ? "readonly" : ""} ${isLoading ? "loading" : ""} ${value === null || value <= 0 ? "inactive" : "active"}`}
        disabled={readOnly || isLoading || value === 1}
        aria-label="Increment rating"
      >
        <ChevronUpIcon className="rating-icon" />
        {isLoading && value === 1 && (
          <div className="rating-loading-spinner">
            <div className="rating-spinner"></div>
          </div>
        )}
      </button>

      <span
        className={`incdec-rating-value ${getValueClass()} ${isLoading ? "loading" : ""}`}
      >
        {value === null ? "—" : value}
      </span>

      <button
        onClick={() => handleClick(false)}
        className={`rating-button incdec-rating-button-down ${readOnly ? "readonly" : ""} ${isLoading ? "loading" : ""} ${value === null || value >= 0 ? "inactive" : "active"}`}
        disabled={readOnly || isLoading || value === -1}
        aria-label="Decrement rating"
      >
        <ChevronDownIcon className="rating-icon" />
        {isLoading && value === -1 && (
          <div className="rating-loading-spinner">
            <div className="rating-spinner"></div>
          </div>
        )}
      </button>
    </div>
  );
};

export default IncDecRating;
