import { useEffect, useRef, useState } from "react";

export default function useLongPress(
  callback: (e: React.PointerEvent) => void,
  ms = 500,
) {
  const [startLongPress, setStartLongPress] = useState(false);
  const eventRef = useRef<React.PointerEvent>(null);

  useEffect(() => {
    let timerId: NodeJS.Timeout | string | number | null = null;
    const event = eventRef.current;
    if (startLongPress && event) {
      timerId = setTimeout(() => callback(event), ms);
    } else if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    return () => {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
    };
  }, [callback, ms, startLongPress]);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") {
        return;
      }
      setStartLongPress(true);
      eventRef.current = e;
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") {
        return;
      }
      setStartLongPress(false);
    },
  };
}
