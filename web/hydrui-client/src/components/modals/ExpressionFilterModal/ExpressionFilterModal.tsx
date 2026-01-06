import { InformationCircleIcon } from "@heroicons/react/24/solid";
import { FocusTrap } from "focus-trap-react";
import React, { useCallback, useRef, useState } from "react";

import { FileMetadata } from "@/api/types";
import ExprInput from "@/components/widgets/ExprInput/ExprInput";
import PushButton from "@/components/widgets/PushButton/PushButton";
import { useShortcut } from "@/hooks/useShortcut";
import { usePageActions } from "@/store/pageStore";
import { useToastActions } from "@/store/toastStore";
import { useUIStateStore } from "@/store/uiStateStore";
import { evaluate } from "@/utils/script/eval";
import { FileValue } from "@/utils/script/file";
import { Parser } from "@/utils/script/parse";
import { StandardResolver } from "@/utils/script/resolver";
import { BooleanValue } from "@/utils/script/value";

import "./index.css";

interface ExpressionFilterModalProps {
  onClose: () => void;
}

const ExpressionFilterModal: React.FC<ExpressionFilterModalProps> = ({
  onClose,
}) => {
  useShortcut({
    Escape: onClose,
  });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { addToast, removeToast } = useToastActions();
  const { filterFilesFromView } = usePageActions();
  const {
    filterExpressionHistory,
    savedFilterExpressions,
    actions: {
      recordFilterExpression,
      clearFilterExpressionHistory,
      saveFilterExpression,
      deleteFilterExpression,
    },
  } = useUIStateStore();
  const [isLoading, setIsLoading] = useState(false);
  const getPlaceholders = useCallback(() => {
    return new StandardResolver(new Map([["file", FileValue.placeholder()]]));
  }, []);
  const execute = useCallback(async () => {
    if (!inputRef.current) {
      return;
    }
    const expr = inputRef.current.value;
    const toast = addToast("Executing filter script...", "info", {
      duration: false,
    });
    setIsLoading(true);
    try {
      const parsed = new Parser(expr).parseExpression();
      await filterFilesFromView(async (file: FileMetadata) => {
        return BooleanValue.from(
          await evaluate(
            new StandardResolver(new Map([["file", new FileValue(file)]])),
            parsed,
          ),
        ).value;
      });
      addToast("Filter operation complete.", "success");
    } catch (e) {
      addToast(`Error running filter: ${e}`, "error");
    } finally {
      setIsLoading(false);
      removeToast(toast);
    }
    recordFilterExpression(expr);
    onClose();
  }, [
    addToast,
    recordFilterExpression,
    onClose,
    filterFilesFromView,
    removeToast,
  ]);
  return (
    <FocusTrap focusTrapOptions={{ allowOutsideClick: true }}>
      <div className="expr-filter-modal-container">
        <div className="expr-filter-modal-wrapper">
          <div className="expr-filter-modal-backdrop" onClick={onClose} />

          <div className="expr-filter-modal-content">
            {/* Header */}
            <div className="expr-filter-modal-header">
              <h3 className="expr-filter-modal-title">Expression Filter</h3>
            </div>

            {/* Content */}
            <div className="expr-filter-modal-body">
              <ExprInput
                onEnter={execute}
                getPlaceholders={getPlaceholders}
                expressionHistory={filterExpressionHistory}
                savedExpressions={savedFilterExpressions}
                clearExpressionHistory={clearFilterExpressionHistory}
                saveExpression={saveFilterExpression}
                deleteExpression={deleteFilterExpression}
                disabled={isLoading}
                ref={inputRef}
              />
              <div className="expr-filter-modal-help">
                <h3>Hint</h3>
                <p>
                  Enter an expression that evaluates to <code>true</code> for
                  files to keep.
                </p>
                <ul>
                  <li>
                    Match files with less than 5 tags:{" "}
                    <code>file.tags.length &lt; 5</code>
                  </li>
                  <li>
                    Match files with suspiciously short URLs:{" "}
                    <code>file.urls.some(lambda url: url.length &lt; 15)</code>
                  </li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="expr-filter-modal-footer">
              <a
                className="push-button primary"
                style={{
                  marginRight: "auto",
                }}
                href="https://hydrui.dev/en/docs/advanced-usage/expressions/"
                target="_blank"
                rel="noreferrer"
              >
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                  }}
                >
                  <InformationCircleIcon
                    width="20"
                    height="20"
                  ></InformationCircleIcon>
                  Help
                </div>
              </a>
              <PushButton
                onClick={onClose}
                variant="secondary"
                disabled={isLoading}
              >
                Cancel
              </PushButton>
              <PushButton
                onClick={execute}
                variant="primary"
                disabled={isLoading}
              >
                Filter
              </PushButton>
            </div>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
};

export default ExpressionFilterModal;
