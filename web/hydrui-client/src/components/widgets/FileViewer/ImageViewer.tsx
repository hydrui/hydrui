import React, { useEffect, useRef, useState } from "react";

import { FileMetadata } from "@/api/types";
import { client } from "@/store/apiStore";

import "./index.css";

// NOTE: This code is cursed. It's just not very good. I'm sorry. It needs to
// be scrapped and rewritten from the ground up, but I have not had a chance.
// The backstory is that it just simply started a lot simpler, because at first
// I really didn't envision having pan/zoom and touch controls. I just wanted a
// basic image viewer and you could always open an image in a new tab if you
// wanted to pan and zoom. However, over time it did occur to me that this
// wasn't an especially great user experience, so I tried to bolt it on, and to
// put it politely, the approach I chose is kind of insane. Some of this logic
// actually made sense at some point, but now it's just a garbled mess. Again...
// sorry. If I rewrite this, the next iteration will be built from first
// principles based on what I want it to support.

interface ImageViewerProps {
  fileId: number;
  fileData: FileMetadata;

  navigateLeft?: () => void;
  navigateRight?: () => void;
}

interface TouchInfo {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startTime: number;
}

interface PinchInfo {
  initialDistance: number;
  initialScale: number;
}

interface ImageDimensions {
  width: number;
  height: number;
}

const ImageViewer: React.FC<ImageViewerProps> = ({
  fileId,
  fileData,
  navigateLeft,
  navigateRight,
}) => {
  const fileUrl = client.getFileUrl(fileId);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [edgeTranslationX, setEdgeTranslationX] = useState(0);
  const [touchInfo, setTouchInfo] = useState<TouchInfo | null>(null);
  const [pinchInfo, setPinchInfo] = useState<PinchInfo | null>(null);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<
    "left" | "right" | null
  >(null);
  const [imageDimensions, setImageDimensions] =
    useState<ImageDimensions | null>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Reset position and scale when fileId changes
  useEffect(() => {
    resetView();
    setIsImageLoaded(false);
    if (fileData.width && fileData.height) {
      centerImageWithSize(fileData.width, fileData.height);
    }
  }, [fileId, fileData]);

  // Add a listener for mouseup events outside the component
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isDragging]);

  const resetView = () => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
    setEdgeTranslationX(0);
    setIsTransitioning(false);
    setTransitionDirection(null);
  };

  const centerImageWithSize = (imgWidth: number, imgHeight: number) => {
    const container = containerRef.current;
    if (!container) return;

    // Get dimensions
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Calculate dimensions for zoom to fit
    const scaledDimensions = {
      width: imgWidth,
      height: imgHeight,
    };

    // Calculate scale to fit (if image is larger than container)
    if (imgWidth > containerWidth || imgHeight > containerHeight) {
      const scaleX = containerWidth / imgWidth;
      const scaleY = containerHeight / imgHeight;
      const scale = Math.min(scaleX, scaleY);
      scaledDimensions.width = imgWidth * scale;
      scaledDimensions.height = imgHeight * scale;
    }

    // Save dimensions for later calculations
    setImageDimensions(scaledDimensions);

    // Center the image
    const centerX = (containerWidth - scaledDimensions.width) / 2;
    const centerY = (containerHeight - scaledDimensions.height) / 2;

    setScale(1.0);
    setTranslateX(centerX);
    setTranslateY(centerY);
  };

  // Set initial image position and scale on load
  const handleImageLoad = () => {
    const img = imageRef.current;
    if (!img) return;
    const imgWidth = img.width;
    const imgHeight = img.height;
    centerImageWithSize(imgWidth, imgHeight);
    setIsImageLoaded(true);
  };

  // Shared zoom functionality for both double-tap and double-click
  const handleZoomAtPoint = (x: number, y: number) => {
    if (scale > 1) {
      // If already zoomed in, reset to original fit view
      if (imageRef.current && containerRef.current && imageDimensions) {
        handleImageLoad();
      }
    } else {
      // Zoom in centered on point location
      const targetScale = 2.5;

      if (imageRef.current && containerRef.current) {
        const rect = imageRef.current.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();

        // Calculate point position relative to image
        const relativeX = x - rect.left;
        const relativeY = y - rect.top;

        // Calculate how much to translate to center the tapped/clicked point
        const newTranslateX = containerRect.width / 2 - relativeX * targetScale;
        const newTranslateY =
          containerRect.height / 2 - relativeY * targetScale;

        setScale(targetScale);

        // Apply constraints to make sure we don't pan beyond image edges
        const [constrainedX, constrainedY] = constrainPan(
          newTranslateX,
          newTranslateY,
          targetScale,
        );
        setTranslateX(constrainedX);
        setTranslateY(constrainedY);
      }
    }
  };

  // Handle double tap to zoom
  const handleDoubleTap = (x: number, y: number) => {
    handleZoomAtPoint(x, y);
  };

  // Handle double click to zoom
  const handleClick = (e: React.MouseEvent) => {
    const currentTime = new Date().getTime();

    // Check if this is a double click (within 300ms of last click)
    if (currentTime - lastClickTime < 300) {
      handleZoomAtPoint(e.clientX, e.clientY);
      setLastClickTime(0); // Reset to prevent triple click
    } else {
      setLastClickTime(currentTime);
    }
  };

  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isImageLoaded || isTransitioning) return;

    // Only initiate drag with left mouse button
    if (e.button !== 0) return;

    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
    });
  };

  // Handle mouse move for dragging
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isImageLoaded || !isDragging) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    // If zoomed in, allow panning
    if (scale > 1) {
      // Normal panning when zoomed in
      setTranslateX((prev) => {
        const newX = prev + deltaX;
        const [constrainedX] = constrainPan(newX, translateY, scale);
        return constrainedX;
      });

      setTranslateY((prev) => {
        const newY = prev + deltaY;
        const [, constrainedY] = constrainPan(translateX, newY, scale);
        return constrainedY;
      });
    } else {
      // Check for edge navigation with drag
      const swipeThreshold = 100;

      setEdgeTranslationX((x) => x + deltaX);

      // Check for left/right edge navigation when not zoomed in
      if (edgeTranslationX > swipeThreshold && navigateLeft) {
        setIsTransitioning(true);
        setTransitionDirection("right");
      } else if (edgeTranslationX > 0 && edgeTranslationX < swipeThreshold) {
        setIsTransitioning(false);
      }

      if (edgeTranslationX < -swipeThreshold && navigateRight) {
        setIsTransitioning(true);
        setTransitionDirection("left");
      } else if (deltaX < 0 && deltaX > -swipeThreshold) {
        setIsTransitioning(false);
      }
    }

    // Update drag start position
    setDragStart({
      x: e.clientX,
      y: e.clientY,
    });
  };

  // Handle mouse up to end dragging
  const handleMouseUp = () => {
    setIsDragging(false);
    setEdgeTranslationX(0);

    if (isTransitioning) {
      if (transitionDirection === "right" && navigateLeft) {
        navigateLeft();
      } else if (transitionDirection === "left" && navigateRight) {
        navigateRight();
      }
      setIsTransitioning(false);
    } else {
      setEdgeTranslationX(0);
    }
  };

  // Calculate distance between two touch points
  const getDistance = (touch1: React.Touch, touch2: React.Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Constrain panning to keep image visible
  const constrainPan = (
    x: number,
    y: number,
    currentScale: number,
  ): [number, number] => {
    if (!imageRef.current || !containerRef.current) return [x, y];

    const img = imageRef.current;
    const container = containerRef.current;

    // Calculate scaled dimensions
    const scaledWidth = img.clientWidth * currentScale;
    const scaledHeight = img.clientHeight * currentScale;

    // Calculate constraints based on the container and image size
    let constrainedX = x;
    let constrainedY = y;

    // If the scaled image is smaller than the container, center it
    if (scaledWidth <= container.clientWidth) {
      constrainedX = (container.clientWidth - scaledWidth) / 2;
    } else {
      // Otherwise constrain horizontal movement
      const maxX = 0;
      const minX = container.clientWidth - scaledWidth;
      constrainedX = Math.max(minX, Math.min(maxX, x));
    }

    // If the scaled image is smaller than the container, center it
    if (scaledHeight <= container.clientHeight) {
      constrainedY = (container.clientHeight - scaledHeight) / 2;
    } else {
      // Otherwise constrain vertical movement
      const maxY = 0;
      const minY = container.clientHeight - scaledHeight;
      constrainedY = Math.max(minY, Math.min(maxY, y));
    }

    return [constrainedX, constrainedY];
  };

  // Handle mouse wheel zooming
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!isImageLoaded || isTransitioning) return;

    e.preventDefault();

    // Calculate zoom direction and factor
    const delta = -e.deltaY || e.deltaX;
    const zoomFactor = delta > 0 ? 1.1 : 0.9;

    // Calculate new scale with limits
    const newScale = Math.max(0.5, Math.min(5, scale * zoomFactor));

    // If scale didn't change, don't proceed
    if (newScale === scale) return;

    if (imageRef.current && containerRef.current) {
      const container = containerRef.current;

      // Get mouse position relative to container
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Get mouse position relative to the image at current scale
      const relativeX = (mouseX - translateX) / scale;
      const relativeY = (mouseY - translateY) / scale;

      // Calculate how much the position will change
      const deltaScale = newScale - scale;

      // Calculate new translation to keep zoom centered on cursor
      const newTranslateX = translateX - relativeX * deltaScale;
      const newTranslateY = translateY - relativeY * deltaScale;

      // Apply constrained values
      const [constrainedX, constrainedY] = constrainPan(
        newTranslateX,
        newTranslateY,
        newScale,
      );

      setScale(newScale);
      setTranslateX(constrainedX);
      setTranslateY(constrainedY);
    }
  };

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isImageLoaded) return;
    e.preventDefault();

    // Store touch start info
    const touch = e.touches[0];
    const currentTime = new Date().getTime();

    // Check for double tap
    if (currentTime - lastTapTime < 300 && e.touches.length === 1) {
      handleDoubleTap(touch.clientX, touch.clientY);
      setLastTapTime(0); // Reset to prevent triple tap
    } else {
      setLastTapTime(currentTime);
    }

    // Single touch for panning or edge navigation
    if (e.touches.length === 1) {
      setTouchInfo({
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastY: touch.clientY,
        startTime: currentTime,
      });
      setPinchInfo(null);
    }
    // Two touches for pinch zooming
    else if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = getDistance(touch1, touch2);

      setPinchInfo({
        initialDistance: distance,
        initialScale: scale,
      });

      // Also update touchInfo for the midpoint between fingers
      const midX = (touch1.clientX + touch2.clientX) / 2;
      const midY = (touch1.clientY + touch2.clientY) / 2;

      setTouchInfo({
        startX: midX,
        startY: midY,
        lastX: midX,
        lastY: midY,
        startTime: currentTime,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isImageLoaded) return;
    e.preventDefault();

    // Single touch for panning or edge navigation
    if (e.touches.length === 1 && touchInfo) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchInfo.lastX;
      const deltaY = touch.clientY - touchInfo.lastY;

      // Check for edge navigation with swipe
      const swipeThreshold = 200;

      if (scale <= 1) {
        setEdgeTranslationX((x) => x + deltaX);

        if (edgeTranslationX > 0 && !navigateLeft) {
          if (edgeTranslationX < 50) {
            setEdgeTranslationX(edgeTranslationX);
          } else {
            setEdgeTranslationX(50);
          }
        }

        if (edgeTranslationX < 0 && !navigateRight) {
          if (edgeTranslationX > -50) {
            setEdgeTranslationX(edgeTranslationX);
          } else {
            setEdgeTranslationX(-50);
          }
        }

        // Check for left/right edge navigation
        if (edgeTranslationX > swipeThreshold && navigateLeft) {
          setIsTransitioning(true);
          setTransitionDirection("right");
        } else if (edgeTranslationX > 0 && edgeTranslationX < swipeThreshold) {
          setIsTransitioning(false);
        }

        if (edgeTranslationX < -swipeThreshold && navigateRight) {
          setIsTransitioning(true);
          setTransitionDirection("left");
        } else if (edgeTranslationX < 0 && edgeTranslationX > -swipeThreshold) {
          setIsTransitioning(false);
        }
      } else {
        setTranslateX((prev) => {
          const newX = prev + deltaX;
          const [constrainedX] = constrainPan(newX, translateY, scale);
          return constrainedX;
        });

        setTranslateY((prev) => {
          const newY = prev + deltaY;
          const [, constrainedY] = constrainPan(translateX, newY, scale);
          return constrainedY;
        });
      }

      // Update last position
      setTouchInfo({
        ...touchInfo,
        lastX: touch.clientX,
        lastY: touch.clientY,
      });
    }
    // Two-finger pinch zoom
    else if (e.touches.length === 2 && pinchInfo && touchInfo) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = getDistance(touch1, touch2);

      // Calculate new scale
      const newScale = Math.max(
        0.5,
        Math.min(
          5,
          pinchInfo.initialScale *
            (currentDistance / pinchInfo.initialDistance),
        ),
      );

      // Calculate midpoint between fingers
      const midX = (touch1.clientX + touch2.clientX) / 2;
      const midY = (touch1.clientY + touch2.clientY) / 2;

      // Update position to keep the midpoint fixed during zoom
      if (imageRef.current && containerRef.current) {
        const deltaScale = newScale - scale;
        const rect = imageRef.current.getBoundingClientRect();

        // Calculate point on image under the midpoint of fingers
        const imageX = (midX - rect.left) / scale;
        const imageY = (midY - rect.top) / scale;

        // Adjust translation to keep the pinch point stable
        const adjustX = imageX * deltaScale;
        const adjustY = imageY * deltaScale;

        const newTranslateX = translateX - adjustX;
        const newTranslateY = translateY - adjustY;

        // Apply constrained values
        const [constrainedX, constrainedY] = constrainPan(
          newTranslateX,
          newTranslateY,
          newScale,
        );

        setScale(newScale);
        setTranslateX(constrainedX);
        setTranslateY(constrainedY);
      }

      // Update last position
      setTouchInfo({
        ...touchInfo,
        lastX: midX,
        lastY: midY,
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();

    if (isTransitioning) {
      if (transitionDirection === "right" && navigateLeft) {
        navigateLeft();
      } else if (transitionDirection === "left" && navigateRight) {
        navigateRight();
      }
      setIsTransitioning(false);
    } else {
      setEdgeTranslationX(0);
    }

    // If pinch or pan ended, keep current position and scale
    if (e.touches.length === 0) {
      setTouchInfo(null);
      setPinchInfo(null);
    }
  };

  return (
    <>
      <div
        key={fileId}
        ref={containerRef}
        className="image-viewer-container"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        style={{
          cursor: isDragging ? "grabbing" : scale > 1 ? "grab" : "default",
        }}
      >
        <img
          ref={imageRef}
          src={fileUrl}
          alt={`File ${fileId}`}
          className={`image-viewer-img ${isTransitioning ? "transitioning" : "normal"}`}
          style={{
            transform: `translate(${translateX + edgeTranslationX}px, ${translateY}px) scale(${scale})`,
            transition: "transform 50ms ease-in-out, opacity 200ms ease-in-out",
            transformOrigin: "top left",
            touchAction: "none",
            pointerEvents: "none", // Prevent the image from capturing mouse events
          }}
          onLoad={handleImageLoad}
        />
      </div>
    </>
  );
};

export default ImageViewer;
