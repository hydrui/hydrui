import { InformationCircleIcon } from "@heroicons/react/24/solid";
import { FocusTrap } from "focus-trap-react";
import React, { useCallback, useRef, useState } from "react";

import ExprInput from "@/components/widgets/ExprInput/ExprInput";
import PushButton from "@/components/widgets/PushButton/PushButton";
import { useShortcut } from "@/hooks/useShortcut";
import { usePageActions, usePageStore } from "@/store/pageStore";
import { useToastActions } from "@/store/toastStore";
import { useUIStateStore } from "@/store/uiStateStore";
import { evaluate } from "@/utils/script/eval";
import { FileValue } from "@/utils/script/file";
import { Parser } from "@/utils/script/parse";
import { StandardResolver } from "@/utils/script/resolver";
import { NumberValue, StringValue } from "@/utils/script/value";

import "./index.css";

interface ExpressionSortModalProps {
  onClose: () => void;
}

const ExpressionSortModal: React.FC<ExpressionSortModalProps> = ({
  onClose,
}) => {
  useShortcut({
    Escape: onClose,
  });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { addToast, removeToast } = useToastActions();
  const { loadedFiles } = usePageStore();
  const { sortFilesFromView } = usePageActions();
  const {
    sortExpressionHistory,
    savedSortExpressions,
    actions: {
      recordSortExpression,
      clearSortExpressionHistory,
      saveSortExpression,
      deleteSortExpression,
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
    const toast = addToast("Executing sort script...", "info", {
      duration: false,
    });
    setIsLoading(true);
    try {
      const parsed = new Parser(expr).parseExpression();
      const scores = (
        await Promise.all(
          loadedFiles.map((file) =>
            evaluate(
              new StandardResolver(new Map([["file", new FileValue(file)]])),
              parsed,
            ),
          ),
        )
      ).map((value) => {
        if (value instanceof NumberValue) {
          return value.value;
        }
        if (value instanceof StringValue) {
          return value.value;
        }
        throw new Error(
          `Expected comparator to return number or string (got ${value.name})`,
        );
      });
      await sortFilesFromView((a: number, b: number) => {
        if (scores[a]! > scores[b]!) {
          return 1;
        } else if (scores[a]! < scores[b]!) {
          return -1;
        } else {
          return 0;
        }
      });
      addToast("Sort operation complete.", "success");
    } catch (e) {
      addToast(`Error running sort: ${e}`, "error");
    } finally {
      setIsLoading(false);
      removeToast(toast);
    }
    recordSortExpression(expr);
    onClose();
  }, [
    addToast,
    recordSortExpression,
    onClose,
    loadedFiles,
    sortFilesFromView,
    removeToast,
  ]);
  return (
    <FocusTrap focusTrapOptions={{ allowOutsideClick: true }}>
      <div className="expr-sort-modal-container">
        <div className="expr-sort-modal-wrapper">
          <div className="expr-sort-modal-backdrop" onClick={onClose} />

          <div className="expr-sort-modal-content">
            {/* Header */}
            <div className="expr-sort-modal-header">
              <h3 className="expr-sort-modal-title">Expression Sort</h3>
            </div>

            {/* Content */}
            <div className="expr-sort-modal-body">
              <ExprInput
                onEnter={execute}
                getPlaceholders={getPlaceholders}
                expressionHistory={sortExpressionHistory}
                savedExpressions={savedSortExpressions}
                clearExpressionHistory={clearSortExpressionHistory}
                saveExpression={saveSortExpression}
                deleteExpression={deleteSortExpression}
                disabled={isLoading}
                ref={inputRef}
              />
              <div className="expr-sort-modal-help">
                <h3>Hint</h3>
                <p>
                  Enter an expression that evaluates to a string or number to
                  sort by for each file.
                </p>
                <ul>
                  <li>
                    Sort by numeric range descending:{" "}
                    <code>-file.numericRating</code>
                  </li>
                  <li>
                    Sort files with a <code>tagme</code> tag first:{" "}
                    <code>file.tags.contains(&quot;tagme&quot;) ? 0 : 1</code>
                  </li>
                  <li>
                    Sort by SHA-256 hash: <code>file.hash</code>
                  </li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="expr-sort-modal-footer">
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
                Sort
              </PushButton>
            </div>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
};

export default ExpressionSortModal;
