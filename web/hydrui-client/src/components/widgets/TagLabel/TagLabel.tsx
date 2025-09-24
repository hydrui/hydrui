import React, { useMemo } from "react";

import { usePreferencesStore } from "@/store/preferencesStore";

interface TagLabelProps {
  tag: string;
  selected?: boolean;
  className?: string;
}

// Helper function to adjust color for selected state
const adjustColor = (hexColor: string): string => {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  let newR = r,
    newG = g,
    newB = b;
  // The background is blue, so red text would be very unreadable.
  // Make the text a lot darker.
  if (newR > 128) {
    newR = 128;
    newG = Math.round(newG * 0.3);
    newB = Math.round(newB * 0.3);
  } else {
    newR = Math.min(255, Math.round(r * 2));
    newG = Math.min(255, Math.round(g * 2));
    newB = Math.min(255, Math.round(b * 2));
  }
  return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
};

const TagLabel: React.FC<TagLabelProps> = React.memo(function TagLabel({
  tag,
  selected = false,
  className = "",
}: TagLabelProps) {
  const { tagColors } = usePreferencesStore();

  const { displayText, color } = useMemo(() => {
    // Handle empty tag case
    if (!tag) {
      return {
        displayText: "",
        color: tagColors.defaultUnnamespacedColor,
      };
    }

    // Check for colon to determine if namespaced
    const colonIndex = tag.indexOf(":");

    // If no colon, it's an unnamespaced tag
    if (colonIndex === -1) {
      const baseColor = tagColors.defaultUnnamespacedColor;
      return {
        displayText: tag,
        color: selected ? adjustColor(baseColor) : baseColor,
      };
    }

    // Get the namespace (part before the colon)
    const namespace = tag.substring(0, colonIndex);

    // If empty namespace (tag starts with colon), remove the colon and treat as unnamespaced
    if (namespace === "") {
      const baseColor = tagColors.defaultUnnamespacedColor;
      return {
        displayText: tag.substring(1), // Remove the leading colon
        color: selected ? adjustColor(baseColor) : baseColor,
      };
    }

    // Otherwise, it's a namespaced tag
    const baseColor =
      tagColors.namespaceColors[namespace] || tagColors.defaultNamespacedColor;
    return {
      displayText: tag,
      color: selected ? adjustColor(baseColor) : baseColor,
    };
  }, [tag, tagColors, selected]);

  // Don't render anything for empty tags
  if (!displayText) {
    return null;
  }

  return (
    <span className={className} style={{ color }}>
      {displayText}
    </span>
  );
});

export default TagLabel;
