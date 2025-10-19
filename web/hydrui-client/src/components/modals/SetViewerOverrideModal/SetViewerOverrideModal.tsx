import { FocusTrap } from "focus-trap-react";
import React, { useCallback, useMemo, useRef, useState } from "react";

import PushButton from "@/components/widgets/PushButton/PushButton";
import { viewers } from "@/file/viewers";
import { useShortcut } from "@/hooks/useShortcut";
import { usePreferencesStore } from "@/store/preferencesStore";

import "./index.css";

interface SetViewerOverrideModalModalProps {
  mime: string;
  isPreview: boolean;
  onClose: () => void;
}

const SetViewerOverrideModalModal: React.FC<
  SetViewerOverrideModalModalProps
> = ({ mime, isPreview, onClose }) => {
  useShortcut({
    Escape: onClose,
  });
  const {
    actions: { setMimeTypeViewerOverride, setMimeTypePreviewerOverride },
  } = usePreferencesStore();
  const inputRef = useRef<HTMLSelectElement | null>(null);
  const [showIncompatible, setShowIncompatible] = useState(false);
  const visibleViewers = useMemo(() => {
    return [...viewers.entries()]
      .filter((entry) => showIncompatible || entry[1].canHandle(mime))
      .map((entry) => entry[0])
      .sort();
  }, [showIncompatible, mime]);
  const save = useCallback(() => {
    if (!inputRef.current) {
      return;
    }
    const value = inputRef.current.value;
    if (isPreview) {
      setMimeTypePreviewerOverride(mime, value);
    } else {
      setMimeTypeViewerOverride(mime, value);
    }
    onClose();
  }, [
    isPreview,
    mime,
    setMimeTypePreviewerOverride,
    setMimeTypeViewerOverride,
    onClose,
  ]);
  return (
    <FocusTrap focusTrapOptions={{ allowOutsideClick: true }}>
      <div className="set-viewer-override-modal-container">
        <div className="set-viewer-override-modal-wrapper">
          <div
            className="set-viewer-override-modal-backdrop"
            onClick={onClose}
          />

          <div className="set-viewer-override-modal-content">
            {/* Header */}
            <div className="set-viewer-override-modal-header">
              <h3 className="set-viewer-override-modal-title">
                Viewer Override For {mime}
              </h3>
            </div>

            {/* Content */}
            <div className="set-viewer-override-modal-body">
              <div className="set-viewer-override-modal-viewer-input-container">
                <select
                  className="set-viewer-override-modal-viewer-input"
                  name="select"
                  ref={inputRef}
                >
                  {visibleViewers.map((n) => (
                    <option value={n} key={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="set-viewer-override-modal-viewer-input-container">
                <label>
                  <input
                    type="checkbox"
                    checked={showIncompatible}
                    className="set-viewer-override-modal-viewer-input"
                    onChange={() => setShowIncompatible(!showIncompatible)}
                  />{" "}
                  Show Incompatible Viewers
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="set-viewer-override-modal-footer">
              <PushButton onClick={onClose} variant="secondary">
                Cancel
              </PushButton>
              <PushButton onClick={save} variant="primary">
                Save
              </PushButton>
            </div>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
};

export default SetViewerOverrideModalModal;
