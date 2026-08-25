import type { TranscriptionCompletion, TranscriptionPhase } from "@/llm";

export function formatTranscriptionProgress(
  phase: TranscriptionPhase,
  annotationsCreated = 0,
): string {
  switch (phase) {
    case "initializing":
      return "Transcribing image: initializing...";
    case "reasoning":
      return "Transcribing image: reasoning...";
    case "output":
      return annotationsCreated === 0
        ? "Transcribing image: generating annotations..."
        : `Transcribing image: generating annotations... ${annotationsCreated} created so far.`;
  }
}

function formatRate(rate: number): string {
  return String(Math.round(rate * 100) / 100);
}

export function formatTranscriptionCompletion(
  annotationsCreated: number,
  completion: TranscriptionCompletion | undefined,
): string {
  const annotationLabel =
    annotationsCreated === 1 ? "annotation" : "annotations";
  const message = `Transcription complete: ${annotationsCreated} ${annotationLabel} created.`;
  const details: string[] = [];
  const promptRate = completion?.timings?.promptTokensPerSecond;
  const generationRate = completion?.timings?.generatedTokensPerSecond;
  if (promptRate !== undefined && promptRate >= 0) {
    details.push(`Prompt processing: ${formatRate(promptRate)} t/s`);
  }
  if (generationRate !== undefined && generationRate >= 0) {
    details.push(`Generation: ${formatRate(generationRate)} t/s`);
  }
  if (completion?.finishReason && completion.finishReason !== "stop") {
    details.push(`Stop reason: ${completion.finishReason}`);
  }
  return details.length === 0 ? message : `${message} ${details.join(" - ")}.`;
}
