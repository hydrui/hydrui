import { create } from "zustand";

import type {
  BoundingBoxFormat,
  LLMProviderKind,
  NoteBox,
  TranscribeEvent,
  TranscribedNote,
  TranscriptionCompletion,
  TranscriptionPhase,
} from "@/llm";

export type TranscriptionTranscriptStatus =
  | "running"
  | "completed"
  | "cancelled"
  | "failed";

export interface TranscriptionTranscriptRequest {
  fileId: number;
  imageWidth: number;
  imageHeight: number;
  providerName: string;
  providerKind: LLMProviderKind;
  providerBaseUrl: string;
  model: string;
  systemPrompt: string;
  translationLanguage: string;
  boundingBoxFormat: BoundingBoxFormat;
  reasoningEffort?: string;
  parameters?: Record<string, unknown>;
}

export interface TranscriptionTranscriptAnnotation {
  index: number;
  status: "streaming" | "completed" | "discarded";
  box?: NoteBox;
  body?: string;
  result?: TranscribedNote | null;
}

export interface TranscriptionTranscript {
  id: string;
  status: TranscriptionTranscriptStatus;
  phase: TranscriptionPhase;
  startedAt: number;
  finishedAt?: number;
  request: TranscriptionTranscriptRequest;
  reasoning: string;
  output: string;
  annotations: TranscriptionTranscriptAnnotation[];
  annotationsCreated: number;
  completion?: TranscriptionCompletion;
  error?: string;
}

interface TranscriptionTranscriptState {
  transcript: TranscriptionTranscript | null;
  isOpen: boolean;
  actions: {
    start: (request: TranscriptionTranscriptRequest) => string;
    recordEvent: (id: string, event: TranscribeEvent) => void;
    setAnnotationsCreated: (id: string, annotationsCreated: number) => void;
    finish: (id: string, annotationsCreated: number) => void;
    fail: (
      id: string,
      status: "cancelled" | "failed",
      error: string | undefined,
      annotationsCreated: number,
    ) => void;
    open: () => void;
    close: () => void;
  };
}

let nextTranscriptId = 1;

function updateAnnotation(
  annotations: TranscriptionTranscriptAnnotation[],
  index: number,
  update: (
    annotation: TranscriptionTranscriptAnnotation,
  ) => TranscriptionTranscriptAnnotation,
): TranscriptionTranscriptAnnotation[] {
  const existingIndex = annotations.findIndex(
    (annotation) => annotation.index === index,
  );
  const existing =
    existingIndex === -1
      ? ({ index, status: "streaming" } as const)
      : annotations[existingIndex]!;
  const updated = update(existing);
  if (existingIndex === -1) return [...annotations, updated];
  return annotations.map((annotation, annotationIndex) =>
    annotationIndex === existingIndex ? updated : annotation,
  );
}

function completionFromEvent(
  event: Extract<TranscribeEvent, { type: "complete" }>,
): TranscriptionCompletion {
  return {
    ...(event.finishReason === undefined
      ? {}
      : { finishReason: event.finishReason }),
    ...(event.timings === undefined ? {} : { timings: event.timings }),
  };
}

export const useTranscriptionTranscriptStore =
  create<TranscriptionTranscriptState>((set) => ({
    transcript: null,
    isOpen: false,
    actions: {
      start: (request) => {
        const id = `transcription-${nextTranscriptId++}`;
        set({
          transcript: {
            id,
            status: "running",
            phase: "initializing",
            startedAt: Date.now(),
            request,
            reasoning: "",
            output: "",
            annotations: [],
            annotationsCreated: 0,
          },
        });
        return id;
      },

      recordEvent: (id, event) => {
        set((state) => {
          const transcript = state.transcript;
          if (!transcript || transcript.id !== id) return state;
          switch (event.type) {
            case "progress":
              return { transcript: { ...transcript, phase: event.phase } };
            case "transcript":
              return {
                transcript: {
                  ...transcript,
                  [event.channel]: transcript[event.channel] + event.content,
                },
              };
            case "box":
              return {
                transcript: {
                  ...transcript,
                  annotations: updateAnnotation(
                    transcript.annotations,
                    event.index,
                    (annotation) => ({ ...annotation, box: event.box }),
                  ),
                },
              };
            case "text":
              return {
                transcript: {
                  ...transcript,
                  annotations: updateAnnotation(
                    transcript.annotations,
                    event.index,
                    (annotation) => ({ ...annotation, body: event.body }),
                  ),
                },
              };
            case "end":
              return {
                transcript: {
                  ...transcript,
                  annotations: updateAnnotation(
                    transcript.annotations,
                    event.index,
                    (annotation) => ({
                      ...annotation,
                      status: event.note ? "completed" : "discarded",
                      result: event.note,
                      ...(event.note
                        ? {
                            box: {
                              x: event.note.x,
                              y: event.note.y,
                              width: event.note.width,
                              height: event.note.height,
                            },
                            body: event.note.body,
                          }
                        : {}),
                    }),
                  ),
                },
              };
            case "complete":
              return {
                transcript: {
                  ...transcript,
                  completion: completionFromEvent(event),
                },
              };
          }
        });
      },

      setAnnotationsCreated: (id, annotationsCreated) => {
        set((state) => {
          const transcript = state.transcript;
          if (!transcript || transcript.id !== id) return state;
          return {
            transcript: { ...transcript, annotationsCreated },
          };
        });
      },

      finish: (id, annotationsCreated) => {
        set((state) => {
          const transcript = state.transcript;
          if (!transcript || transcript.id !== id) return state;
          return {
            transcript: {
              ...transcript,
              status: "completed",
              finishedAt: Date.now(),
              annotationsCreated,
            },
          };
        });
      },

      fail: (id, status, error, annotationsCreated) => {
        set((state) => {
          const transcript = state.transcript;
          if (!transcript || transcript.id !== id) return state;
          return {
            transcript: {
              ...transcript,
              status,
              finishedAt: Date.now(),
              annotationsCreated,
              ...(error === undefined ? {} : { error }),
            },
          };
        });
      },

      open: () => set((state) => (state.transcript ? { isOpen: true } : state)),
      close: () => set({ isOpen: false }),
    },
  }));

export const useTranscriptionTranscriptActions = () =>
  useTranscriptionTranscriptStore((state) => state.actions);
