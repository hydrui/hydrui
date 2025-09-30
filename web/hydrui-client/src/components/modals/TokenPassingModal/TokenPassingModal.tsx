import { FocusTrap } from "focus-trap-react";
import React from "react";

import PushButton from "@/components/widgets/PushButton/PushButton";
import { useShortcut } from "@/hooks/useShortcut";
import { usePreferencesActions } from "@/store/preferencesStore";

import "./index.css";

interface TokenPassingModalProps {
  onClose: () => void;
}

const TokenPassingModal: React.FC<TokenPassingModalProps> = ({ onClose }) => {
  useShortcut({
    Escape: onClose,
  });

  const { setAllowTokenPassing } = usePreferencesActions();

  const handleAllow = () => {
    setAllowTokenPassing(true);
    onClose();
  };

  return (
    <FocusTrap focusTrapOptions={{ allowOutsideClick: true }}>
      <div className="token-passing-modal-container">
        <div className="token-passing-modal-wrapper">
          <div className="token-passing-modal-backdrop" onClick={onClose} />

          <div className="token-passing-modal-content">
            {/* Header */}
            <div className="token-passing-modal-header">
              <h3 className="token-passing-modal-title">
                Token Passing Required
              </h3>
            </div>

            {/* Content */}
            <div className="token-passing-modal-body">
              <p className="token-passing-modal-message">
                This action requires passing your hydrus network token to an
                external web application. While it is unlikely to be a problem,
                technically,{" "}
                <b>
                  the external web application can use this token to access your
                  hydrus network API if it is malicious
                </b>
                . If you want to mitigate this risk, when self-hosting Hydrui,
                server mode provides a more secure way to proxy requests from
                external web applications to the hydrus network API.
              </p>
              <p className="token-passing-modal-message">
                Most users can probably allow token passing without losing
                sleep. Just be aware that it is insecure.
              </p>
            </div>

            {/* Footer */}
            <div className="token-passing-modal-footer">
              <PushButton onClick={onClose} variant="secondary">
                Cancel
              </PushButton>
              <PushButton onClick={handleAllow} variant="primary">
                Allow Token Passing
              </PushButton>
            </div>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
};

export default TokenPassingModal;
