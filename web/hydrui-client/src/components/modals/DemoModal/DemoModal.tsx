import { XMarkIcon } from "@heroicons/react/24/solid";
import { FocusTrap } from "focus-trap-react";
import React from "react";

import PushButton from "@/components/widgets/PushButton/PushButton";
import { useShortcut } from "@/hooks/useShortcut";

import "./index.css";

interface DemoModalProps {
  onClose: () => void;
}

const DemoModal: React.FC<DemoModalProps> = ({ onClose }) => {
  useShortcut({
    Escape: onClose,
  });

  return (
    <FocusTrap focusTrapOptions={{ allowOutsideClick: true }}>
      <div className="demo-modal-container">
        <div className="demo-modal-wrapper">
          {/* Backdrop */}
          <div className="demo-modal-backdrop" onClick={onClose} />

          {/* Modal */}
          <div className="demo-modal-content">
            <div className="demo-modal-content-wrapper">
              <div className="demo-modal-header">
                <h2 className="demo-modal-title">About This Demo</h2>
                <button
                  onClick={onClose}
                  className="demo-modal-close-button"
                  aria-label="Close"
                >
                  <XMarkIcon className="demo-modal-close-icon" />
                </button>
              </div>

              <div className="demo-modal-body">
                <p>This is a local-only demo of Hydrui.</p>
                <p>
                  <b>
                    This demo runs entirely in your browser. No data is ever
                    sent anywhere, and all data will be lost upon reloading the
                    page.
                  </b>
                </p>
                <p>
                  You can upload files, edit tags, URLs, notes, and play with
                  search queries here. Not all functionality is 100% identical
                  to using Hydrui with a real hydrus network instance, but it is
                  fairly similar. You can get an idea of what Hydrui feels like
                  and is capable of.
                </p>
                <p>
                  For example, you can drag in a Photoshop .psd file to test
                  Hydrui&rsquo;s PSD viewer.
                </p>
                <p>
                  If you like this demo, be sure to check out the{" "}
                  <a href="https://hydrui.dev/en/docs/basic-usage/getting-started/">
                    documentation
                  </a>{" "}
                  and try setting up Hydrui with your own hydrus network
                  instance.
                </p>
              </div>
            </div>
            <div className="demo-modal-footer">
              <PushButton onClick={onClose}>Dismiss</PushButton>
            </div>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
};

export default DemoModal;
