import { FocusTrap } from "focus-trap-react";
import React, { useCallback, useMemo, useRef, useState } from "react";

import PushButton from "@/components/widgets/PushButton/PushButton";
import { HydrusFileType, filetypeEnumToString } from "@/constants/filetypes";
import { viewers } from "@/file/viewers";
import { useShortcut } from "@/hooks/useShortcut";
import { usePreferencesStore } from "@/store/preferencesStore";

import "./index.css";

interface SetViewerOverrideModalModalProps {
  fileType: HydrusFileType;
  isPreview: boolean;
  onClose: () => void;
}

const SetViewerOverrideModalModal: React.FC<
  SetViewerOverrideModalModalProps
> = ({ fileType, isPreview, onClose }) => {
  useShortcut({
    Escape: onClose,
  });
  const {
    actions: { setFileTypeViewerOverride, setFileTypePreviewerOverride },
  } = usePreferencesStore();
  const inputRef = useRef<HTMLSelectElement | null>(null);
  const [showIncompatible, setShowIncompatible] = useState(false);
  const visibleViewers = useMemo(() => {
    return [...viewers.entries()]
      .filter((entry) => showIncompatible || entry[1].canHandle(fileType))
      .map((entry) => entry[0])
      .sort();
  }, [showIncompatible, fileType]);
  const save = useCallback(() => {
    if (!inputRef.current) {
      return;
    }
    const value = inputRef.current.value;
    if (isPreview) {
      setFileTypePreviewerOverride(fileType, value);
    } else {
      setFileTypeViewerOverride(fileType, value);
    }
    onClose();
  }, [
    isPreview,
    fileType,
    setFileTypePreviewerOverride,
    setFileTypeViewerOverride,
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
                Viewer Override For {filetypeEnumToString.get(fileType)}
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
