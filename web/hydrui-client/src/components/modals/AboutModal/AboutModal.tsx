/// <reference types="vite/client" />
import { XMarkIcon } from "@heroicons/react/24/solid";
import React from "react";
import { ErrorBoundary } from "react-error-boundary";

import PushButton from "@/components/widgets/PushButton/PushButton";

import { SpinningCube } from "./SpinningCube";
import "./index.css";

interface AboutModalProps {
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
  return (
    <div className="about-modal-container">
      <div className="about-modal-wrapper">
        {/* Backdrop */}
        <div className="about-modal-backdrop" onClick={onClose} />

        {/* Modal */}
        <div className="about-modal-content">
          <div className="about-modal-cube-container">
            <ErrorBoundary fallback={<div className="w-[250px] h-[250px]" />}>
              <SpinningCube width={250} height={250} />
            </ErrorBoundary>
          </div>

          <div className="about-modal-content-wrapper">
            <div className="about-modal-header">
              <h2 className="about-modal-title">About Hydrui</h2>
              <button
                onClick={onClose}
                className="about-modal-close-button"
                aria-label="Close"
              >
                <XMarkIcon className="about-modal-close-icon" />
              </button>
            </div>

            <div className="about-modal-body">
              <p>Hydrui is a web interface for the hydrus network.</p>

              <div className="about-modal-section">
                <h3 className="about-modal-section-title">Version</h3>
                <p className="about-modal-section-text">
                  {import.meta.env.VITE_HYDRUI_VERSION}
                </p>
              </div>

              <div className="about-modal-section">
                <h3 className="about-modal-section-title">License</h3>
                <p className="about-modal-section-text">MIT License</p>
              </div>

              <p>
                <a href="/thirdparty.html" target="_blank">
                  View third party licenses
                </a>
              </p>
            </div>
          </div>
          <div className="about-modal-footer">
            <PushButton onClick={onClose}>Thanks, Shitman!</PushButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutModal;
