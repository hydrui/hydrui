import { FocusTrap } from "focus-trap-react";
import React, { useCallback, useState } from "react";

import PushButton from "@/components/widgets/PushButton/PushButton";
import { useShortcut } from "@/hooks/useShortcut";
import { useToastStore } from "@/store/toastStore";
import { isServerMode } from "@/utils/serverMode";
import type { WorkerResponse } from "@/workers/bugreport.worker";

import "./index.css";

interface BrokenImageModalProps {
  onClose: () => void;
  url: string;
}

const BrokenImageModal: React.FC<BrokenImageModalProps> = ({
  onClose,
  url,
}) => {
  const [isAgreed, setIsAgreed] = useState(false);
  const {
    actions: { addToast, removeToast, updateToastProgress },
  } = useToastStore();

  const sendBrokenImage = useCallback(async () => {
    const worker = new Worker(
      new URL("@/workers/bugreport.worker.ts", import.meta.url),
      {
        type: "module",
      },
    );
    const progressToast = addToast("Sending report...", "info");
    worker.addEventListener("message", (event) => {
      const response = event.data as WorkerResponse;
      if (response.type === "reportBrokenImage") {
        if (response.success) {
          removeToast(progressToast);
          addToast("Report submitted! Thank you.", "success", 5000);
        } else {
          removeToast(progressToast);
          addToast(`Failed to submit report: ${response.error}`, "error", 5000);
        }
      } else if (response.type === "reportBrokenImageProgress") {
        updateToastProgress(progressToast, response.progress * 100);
      }
    });
    worker.postMessage({
      type: "reportBrokenImage",
      url,
      serverMode: isServerMode,
    });
  }, [url, addToast, removeToast, updateToastProgress]);

  useShortcut({
    Escape: onClose,
  });

  return (
    <FocusTrap focusTrapOptions={{ allowOutsideClick: true }}>
      <div className="broken-image-modal-container">
        <div className="broken-image-modal-wrapper">
          <div className="broken-image-modal-backdrop" onClick={onClose} />

          <div className="broken-image-modal-content">
            <div className="broken-image-modal-header">
              <h3 className="broken-image-modal-title">Broken Image</h3>
            </div>

            <div className="broken-image-modal-body">
              <p className="broken-image-modal-message">
                The Hydrui PSD viewer is experimental. We&rsquo;re working on
                improving the accuracy, but it&rsquo;s challenging due to the
                complexity of the PSD format.
              </p>
              <p className="broken-image-modal-message">
                Please send us PSDs that you have that load or render
                improperly. It helps us triage and prioritize different kinds of
                bugs in our parsing and rendering code.
              </p>
              <p className="broken-image-modal-message">
                We realize there is some sketchy and personal stuff inside of
                many PSDs. Rest assured that we don&lsquo;t really care
                what&lsquo;s in the files, beyond that it is not CSAM. Reports
                are encrypted end-to-end so only Hydrui devs can see them, even
                in the event of a server breach, and we never store the full IP
                address of a request (but you can use a VPN or Tor if you want,
                still.) Once we have reproduced the issue in a new PSD file, we
                can delete the submission; they are not intended to be kept
                long-term.
              </p>
              <input
                className="broken-image-modal-checkbox"
                type="checkbox"
                id="agree"
                checked={isAgreed}
                onChange={() => setIsAgreed(!isAgreed)}
              />
              <label
                className="broken-image-modal-checkbox-label"
                htmlFor="agree"
              >
                I understand and want to submit a broken file.
              </label>
              <PushButton
                onClick={sendBrokenImage}
                variant="secondary"
                disabled={!isAgreed}
              >
                Submit Current File
              </PushButton>
            </div>

            <div className="broken-image-modal-footer">
              <PushButton onClick={onClose} variant="secondary">
                Close
              </PushButton>
            </div>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
};

export default BrokenImageModal;
