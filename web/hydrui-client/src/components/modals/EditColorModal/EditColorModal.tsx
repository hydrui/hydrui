import { FocusTrap } from "focus-trap-react";
import React, { useCallback, useState } from "react";

import ColorEditor from "@/components/widgets/ColorEditor/ColorEditor";
import PushButton from "@/components/widgets/PushButton/PushButton";
import { useShortcut } from "@/hooks/useShortcut";
import { usePreferencesStore } from "@/store/preferencesStore";

import "./index.css";

interface EditColorProps {
  namespace: string | boolean;
  onClose: () => void;
}

const EditColorModal: React.FC<EditColorProps> = ({ namespace, onClose }) => {
  const {
    tagColors: {
      defaultNamespacedColor,
      defaultUnnamespacedColor,
      namespaceColors,
    },
    actions: {
      setDefaultNamespacedColor,
      setDefaultUnnamespacedColor,
      setNamespaceColor,
    },
  } = usePreferencesStore();
  const colorName =
    namespace === true
      ? "default with namespace"
      : namespace === false
        ? "default without namespace"
        : namespace;
  const [color, setColor] = useState(
    namespace === true
      ? defaultNamespacedColor
      : namespace === false
        ? defaultUnnamespacedColor
        : namespaceColors[namespace],
  );
  const saveColor = useCallback(() => {
    if (namespace === true) {
      setDefaultNamespacedColor(color);
    } else if (namespace === false) {
      setDefaultUnnamespacedColor(color);
    } else {
      setNamespaceColor(namespace, color);
    }
    onClose();
  }, [
    namespace,
    onClose,
    setDefaultNamespacedColor,
    color,
    setDefaultUnnamespacedColor,
    setNamespaceColor,
  ]);
  useShortcut({
    Escape: onClose,
  });
  return (
    <FocusTrap focusTrapOptions={{ allowOutsideClick: true }}>
      <div className="edit-color-modal-container">
        <div className="edit-color-modal-wrapper">
          <div className="edit-color-modal-backdrop" onClick={onClose} />
          <div className="edit-color-modal-content">
            {/* Header */}
            <div className="edit-color-modal-header">
              <h3 className="edit-color-modal-title">
                Edit Color ({colorName})
              </h3>
            </div>
            {/* Content */}
            <div className="edit-color-modal-body">
              <ColorEditor color={color} setColor={setColor}></ColorEditor>
            </div>
            {/* Footer */}
            <div className="edit-color-modal-footer">
              <PushButton onClick={onClose} variant="secondary">
                Cancel
              </PushButton>
              <PushButton onClick={saveColor} variant="primary">
                Save
              </PushButton>
            </div>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
};

export default EditColorModal;
