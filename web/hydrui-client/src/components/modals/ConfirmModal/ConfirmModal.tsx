import React from "react";

import PushButton from "@/components/widgets/PushButton/PushButton";

import "./index.css";

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel: React.ReactNode;
  cancelLabel: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="confirm-modal-container">
      <div className="confirm-modal-wrapper">
        <div className="confirm-modal-backdrop" onClick={onCancel} />

        <div className="confirm-modal-content">
          {/* Header */}
          <div className="confirm-modal-header">
            <h3 className="confirm-modal-title">{title}</h3>
          </div>

          {/* Content */}
          <div className="confirm-modal-body">
            <p className="confirm-modal-message">{message}</p>
          </div>

          {/* Footer */}
          <div className="confirm-modal-footer">
            <PushButton onClick={onCancel} variant="secondary">
              {cancelLabel}
            </PushButton>
            <PushButton onClick={onConfirm} variant="primary">
              {confirmLabel}
            </PushButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
