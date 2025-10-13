import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import React from "react";

import "./index.css";

interface CrashProps {
  error?: Error | undefined;
  errorInfo?: React.ErrorInfo | undefined;
  resetErrorBoundary?: () => void | undefined;
  componentName?: string | undefined;
}

const Crash: React.FC<CrashProps> = ({
  error,
  errorInfo,
  resetErrorBoundary,
  componentName = "Component",
}) => {
  const newIssueURL =
    "https://github.com/hydrui/hydrui/issues/new" +
    `?title=Crash+in+${encodeURIComponent(componentName)}` +
    `&body=Component+error:+${encodeURIComponent(String(error))}`;
  return (
    <div className="crash-container">
      <div className="crash-content">
        <div className="crash-icon-wrapper">
          <ExclamationTriangleIcon className="crash-icon" />
        </div>

        <h3 className="crash-title">{componentName} has crashed</h3>

        <p className="crash-message">
          An error occurred during component rendering. This is a bug.{" "}
          <a href={newIssueURL}>Open a bug report on GitHub?</a>
        </p>

        <p className="crash-message">
          (For privacy reasons, error information is never automatically sent
          anywhere. Please consider reporting this issue! Remember to describe
          what you were doing when it crashed.)
        </p>

        <p className="crash-message">
          If Hydrui has become inaccessible, you may need to clear your local
          storage to continue. Sorry.
        </p>

        {error && (
          <div className="crash-error-details">
            <div className="crash-error-name">{error.name}</div>
            <div className="crash-error-message">{error.message}</div>
          </div>
        )}

        {errorInfo && (
          <details className="crash-stack-details">
            <summary className="crash-stack-summary">Render Stack</summary>
            <pre className="crash-stack-trace">
              {String(errorInfo.componentStack).trim()}
            </pre>
          </details>
        )}

        {resetErrorBoundary && (
          <button onClick={resetErrorBoundary} className="crash-retry-button">
            Reset
          </button>
        )}
      </div>
    </div>
  );
};

export default Crash;
