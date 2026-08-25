import { XMarkIcon } from "@heroicons/react/24/solid";
import { FocusTrap } from "focus-trap-react";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import PushButton from "@/components/widgets/PushButton/PushButton";
import { useShortcut } from "@/hooks/useShortcut";
import {
  TranscriptionTranscript,
  TranscriptionTranscriptAnnotation,
  useTranscriptionTranscriptActions,
  useTranscriptionTranscriptStore,
} from "@/store/transcriptionTranscriptStore";

import "./index.css";
import { formatDuration } from "@/utils/format";

const STATUS_LABELS: Record<TranscriptionTranscript["status"], string> = {
  running: "In progress",
  completed: "Complete",
  cancelled: "Cancelled",
  failed: "Failed",
};

const PHASE_LABELS: Record<TranscriptionTranscript["phase"], string> = {
  initializing: "Initializing",
  reasoning: "Reasoning",
  output: "Generating annotations",
};

const stopPropagation = (event: React.SyntheticEvent) => {
  event.stopPropagation();
};

function formatRate(rate: number | undefined): string {
  return rate === undefined ? "Not reported" : `${rate.toFixed(2)} t/s`;
}

function formatBox(box: TranscriptionTranscriptAnnotation["box"]): string {
  if (!box) return "Waiting for bounding box";
  const round = (value: number) => Math.round(value * 100) / 100;
  return `X: ${round(box.x)}, Y: ${round(box.y)}, Width: ${round(box.width)}, Height: ${round(box.height)}`;
}

function serializeTranscript(transcript: TranscriptionTranscript): string {
  return JSON.stringify(
    {
      ...transcript,
      startedAt: new Date(transcript.startedAt).toISOString(),
      ...(transcript.finishedAt === undefined
        ? {}
        : { finishedAt: new Date(transcript.finishedAt).toISOString() }),
    },
    null,
    2,
  );
}

interface TranscriptStreamProps {
  title: string;
  value: string;
  emptyMessage: string;
  live: boolean;
}

const TranscriptStream: React.FC<TranscriptStreamProps> = ({
  title,
  value,
  emptyMessage,
  live,
}) => {
  const streamRef = useRef<HTMLPreElement>(null);
  const followOutput = useRef(true);

  useLayoutEffect(() => {
    const element = streamRef.current;
    if (element && followOutput.current)
      element.scrollTop = element.scrollHeight;
  }, [value]);

  return (
    <section className="transcription-transcript-stream">
      <div className="transcription-transcript-section-heading">
        <h3>{title}</h3>
        <div>
          {live && <span className="transcription-transcript-live">Live</span>}
          <span>{value.length.toLocaleString()} characters</span>
        </div>
      </div>
      <pre
        ref={streamRef}
        aria-label={title}
        className={value ? "" : "empty"}
        onScroll={(event) => {
          const element = event.currentTarget;
          followOutput.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            32;
        }}
      >
        {value || emptyMessage}
      </pre>
    </section>
  );
};

interface ParsedAnnotationProps {
  annotation: TranscriptionTranscriptAnnotation;
}

const ParsedAnnotation: React.FC<ParsedAnnotationProps> = ({ annotation }) => {
  const contents = annotation.result?.contents ?? [];
  return (
    <article className="transcription-transcript-annotation">
      <div className="transcription-transcript-annotation-heading">
        <h4>Annotation {annotation.index + 1}</h4>
        <span className={`status-${annotation.status}`}>
          {annotation.status}
        </span>
      </div>
      <div className="transcription-transcript-annotation-box">
        {formatBox(annotation.box)}
      </div>
      {contents.length > 0 ? (
        <div className="transcription-transcript-annotation-contents">
          {contents.map((content, index) => (
            <div key={`${content.contentType}-${content.language}-${index}`}>
              <span>
                {content.contentType} &bull; {content.language}
              </span>
              <p>{content.body || "(empty)"}</p>
            </div>
          ))}
        </div>
      ) : annotation.body !== undefined ? (
        <div className="transcription-transcript-annotation-contents">
          <div>
            <span>translation &bull; streaming</span>
            <p>{annotation.body || "(empty)"}</p>
          </div>
        </div>
      ) : (
        <p className="transcription-transcript-annotation-pending">
          {annotation.status === "discarded"
            ? "The output did not contain a usable bounding box."
            : "Waiting for annotation content..."}
        </p>
      )}
    </article>
  );
};

interface TranscriptModalContentProps {
  transcript: TranscriptionTranscript;
}

const TranscriptModalContent: React.FC<TranscriptModalContentProps> = ({
  transcript,
}) => {
  const { close } = useTranscriptionTranscriptActions();
  const [now, setNow] = useState(Date.now());
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  useShortcut({ Escape: close });

  useEffect(() => {
    setCopyState("idle");
  }, [transcript.id]);

  useEffect(() => {
    if (transcript.status !== "running") return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [transcript.status]);

  const finishedAt = transcript.finishedAt ?? now;
  const parameters = transcript.request.parameters;
  const hasParameters = parameters && Object.keys(parameters).length > 0;

  const copyTranscript = async () => {
    try {
      await navigator.clipboard.writeText(serializeTranscript(transcript));
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return createPortal(
    <FocusTrap focusTrapOptions={{ allowOutsideClick: true }}>
      <div
        className="transcription-transcript-modal-container"
        onClick={stopPropagation}
        onMouseDown={stopPropagation}
        onPointerDown={stopPropagation}
        onTouchStart={stopPropagation}
        onTouchMove={stopPropagation}
        onTouchEnd={stopPropagation}
        onWheel={stopPropagation}
      >
        <div className="transcription-transcript-modal-wrapper">
          <div
            className="transcription-transcript-modal-backdrop"
            onClick={close}
          />
          <div
            className="transcription-transcript-modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transcription-transcript-title"
          >
            <header className="transcription-transcript-modal-header">
              <div>
                <h2 id="transcription-transcript-title">
                  Transcription transcript
                </h2>
                <span
                  className={`transcription-transcript-status status-${transcript.status}`}
                >
                  {STATUS_LABELS[transcript.status]}
                </span>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close transcript"
                title="Close"
                autoFocus
              >
                <XMarkIcon />
              </button>
            </header>

            <div className="transcription-transcript-modal-body">
              <dl className="transcription-transcript-summary">
                <div>
                  <dt>File ID</dt>
                  <dd>{transcript.request.fileId}</dd>
                </div>
                <div>
                  <dt>Provider</dt>
                  <dd>{transcript.request.providerName || "Unnamed"}</dd>
                </div>
                <div>
                  <dt>Model</dt>
                  <dd>{transcript.request.model}</dd>
                </div>
                <div>
                  <dt>Phase</dt>
                  <dd>{transcript.status === "running" ? PHASE_LABELS[transcript.phase] : "Finished"}</dd>
                </div>
                <div>
                  <dt>Started</dt>
                  <dd>{new Date(transcript.startedAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Duration</dt>
                  <dd>{formatDuration((finishedAt - transcript.startedAt) / 1000)}</dd>
                </div>
                <div>
                  <dt>Annotations</dt>
                  <dd>{transcript.annotationsCreated}</dd>
                </div>
                <div>
                  <dt>Finish reason</dt>
                  <dd>
                    {/* This is hideous. But, it works. */}
                    {transcript.completion?.finishReason?.toLowerCase().replace(/\b\w/g, char => char.toUpperCase()) ?? "Not reported"}
                  </dd>
                </div>
              </dl>

              {transcript.error && (
                <div className="transcription-transcript-error">
                  <strong>Error</strong>
                  <span>{transcript.error}</span>
                </div>
              )}

              <details className="transcription-transcript-request">
                <summary>Request details</summary>
                <dl>
                  <div>
                    <dt>Endpoint</dt>
                    <dd>{transcript.request.providerBaseUrl}</dd>
                  </div>
                  <div>
                    <dt>Provider type</dt>
                    <dd>{transcript.request.providerKind}</dd>
                  </div>
                  <div>
                    <dt>Image dimensions</dt>
                    <dd>
                      {transcript.request.imageWidth} &times;{" "}
                      {transcript.request.imageHeight}
                    </dd>
                  </div>
                  <div>
                    <dt>Translation language</dt>
                    <dd>{transcript.request.translationLanguage}</dd>
                  </div>
                  <div>
                    <dt>Bounding-box format</dt>
                    <dd>{transcript.request.boundingBoxFormat}</dd>
                  </div>
                  <div>
                    <dt>Reasoning effort</dt>
                    <dd>
                      {transcript.request.reasoningEffort ?? "Provider default"}
                    </dd>
                  </div>
                </dl>
                <h4>Effective system prompt</h4>
                <pre>{transcript.request.systemPrompt}</pre>
                {hasParameters && (
                  <>
                    <h4>Additional request parameters</h4>
                    <pre>{JSON.stringify(parameters, null, 2)}</pre>
                  </>
                )}
              </details>

              <div className="transcription-transcript-streams">
                <TranscriptStream
                  title="Reasoning"
                  value={transcript.reasoning}
                  emptyMessage={
                    transcript.status === "running"
                      ? "Waiting for reasoning output..."
                      : "The provider did not return a separate reasoning stream."
                  }
                  live={transcript.status === "running"}
                />
                <TranscriptStream
                  title="Raw annotation output"
                  value={transcript.output}
                  emptyMessage={
                    transcript.status === "running"
                      ? "Waiting for annotation output..."
                      : "The provider did not return annotation output."
                  }
                  live={transcript.status === "running"}
                />
              </div>

              <section className="transcription-transcript-parsed">
                <div className="transcription-transcript-section-heading">
                  <h3>Parsed annotations</h3>
                  <span>
                    {transcript.annotations.length.toLocaleString()} observed
                  </span>
                </div>
                {transcript.annotations.length > 0 ? (
                  <div className="transcription-transcript-annotation-list">
                    {transcript.annotations.map((annotation) => (
                      <ParsedAnnotation
                        key={annotation.index}
                        annotation={annotation}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="transcription-transcript-empty-parsed">
                    {transcript.status === "running"
                      ? "No annotations parsed yet."
                      : "No annotations were parsed."}
                  </p>
                )}
              </section>

              <section className="transcription-transcript-metrics">
                <h3>Provider metrics</h3>
                <dl>
                  <div>
                    <dt>Prompt processing</dt>
                    <dd>
                      {formatRate(
                        transcript.completion?.timings?.promptTokensPerSecond,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Generation</dt>
                    <dd>
                      {formatRate(
                        transcript.completion?.timings
                          ?.generatedTokensPerSecond,
                      )}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>

            <footer className="transcription-transcript-modal-footer">
              {copyState === "failed" && (
                <span>Could not copy the transcript.</span>
              )}
              <PushButton onClick={copyTranscript} variant="secondary">
                {copyState === "copied" ? "Copied" : "Copy transcript"}
              </PushButton>
              <PushButton onClick={close}>Close</PushButton>
            </footer>
          </div>
        </div>
      </div>
    </FocusTrap>,
    document.body,
  );
};

const TranscriptionTranscriptModal: React.FC = () => {
  const transcript = useTranscriptionTranscriptStore(
    (state) => state.transcript,
  );
  const isOpen = useTranscriptionTranscriptStore((state) => state.isOpen);
  return isOpen && transcript ? (
    <TranscriptModalContent transcript={transcript} />
  ) : null;
};

export default TranscriptionTranscriptModal;
