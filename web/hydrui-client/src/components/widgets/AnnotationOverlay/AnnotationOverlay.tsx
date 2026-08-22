import {
  ChatBubbleBottomCenterTextIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { FileMetadata } from "@/api/types";
import {
  Annotation,
  LocalAnnotation,
  buildAnnotationNoteUpdate,
  deserializeAnnotations,
  newAnnotation,
} from "@/file/annotation";
import { createProvider } from "@/llm";
import { client } from "@/store/apiStore";
import { useSelectedLLMProvider } from "@/store/llmStore";
import { usePageActions } from "@/store/pageStore";
import { useToastActions } from "@/store/toastStore";

import { fitAnnotationFontSize } from "./fitText";
import "./index.css";

const stopEventPropagation = (event: React.SyntheticEvent) => {
  event.stopPropagation();
};

// Stack unpositioned notes down the left edge of an image before bounding box
// arrives.
function placeholderBox(
  slot: number,
  imgWidth: number,
  imgHeight: number,
): { x: number; y: number; width: number; height: number } {
  const width = Math.max(40, imgWidth * 0.25);
  const height = Math.max(20, imgHeight * 0.06);
  const margin = Math.max(8, imgHeight * 0.01);
  return {
    x: margin,
    y: (margin + slot * (height + margin)) % Math.max(1, imgHeight - height),
    width,
    height,
  };
}

export interface AnnotationOverlayProps {
  fileId: number;
  fileData: FileMetadata;
  // URL of the image currently displayed by the viewer. This can be a
  // rendered image rather than the original file (for example, a PSD).
  sourceUrl: string;
  // Pixel dimensions of the rendered <img> at scale = 1.
  displayWidth: number;
  displayHeight: number;
  // Transform applied to the <img>.
  translateX: number;
  translateY: number;
  scale: number;
}

const AnnotationOverlay: React.FC<AnnotationOverlayProps> = ({
  fileId,
  fileData,
  sourceUrl,
  displayWidth,
  displayHeight,
  translateX,
  translateY,
  scale,
}) => {
  const { updateFileNotes } = usePageActions();
  const { addToast } = useToastActions();
  const provider = useSelectedLLMProvider();

  const [visible, setVisible] = useState(true);
  const [editing, setEditing] = useState(false);
  const [annotations, setAnnotations] = useState<LocalAnnotation[]>([]);
  const [originalNoteNames, setOriginalNoteNames] = useState<Set<string>>(
    new Set(),
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const transcribeAbort = useRef<AbortController | null>(null);

  // Load notes from current metadata.
  useEffect(() => {
    const annotations = deserializeAnnotations(fileData);
    setAnnotations(annotations);
    setOriginalNoteNames(new Set(annotations.map((note) => note.$hydrusNote)));
    setDirty(false);
    setEditing(false);
  }, [fileId, fileData]);

  // Cancel any active transcription when unmounting / file changes.
  useEffect(() => {
    return () => {
      transcribeAbort.current?.abort();
    };
  }, [fileId]);

  const updateAnnotation = useCallback(
    (id: string, patch: Partial<LocalAnnotation>) => {
      setAnnotations((prev) =>
        prev.map((n) => (n.$id === id ? { ...n, ...patch } : n)),
      );
      setDirty(true);
    },
    [],
  );

  const removeAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((n) => n.$id !== id));
    setDirty(true);
  }, []);

  const addNote = useCallback(() => {
    const w = Math.max(40, displayWidth * 0.2);
    const h = Math.max(20, displayHeight * 0.05);
    setAnnotations((prev) => [
      ...prev,
      newAnnotation(
        (displayWidth - w) / 2,
        (displayHeight - h) / 2,
        w,
        h,
        "",
        displayWidth,
        displayHeight,
      ),
    ]);
    setDirty(true);
  }, [displayWidth, displayHeight]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const { notes, noteNamesToDelete } = buildAnnotationNoteUpdate(
        annotations,
        originalNoteNames,
      );
      if (noteNamesToDelete.length > 0) {
        await client.deleteNotes({
          file_id: fileId,
          note_names: noteNamesToDelete,
        });
      }
      let savedNotes = notes;
      if (Object.keys(notes).length > 0) {
        const response = await client.addNotes({
          file_id: fileId,
          notes,
          conflict_resolution: 0,
        });
        savedNotes = response.notes;
      }
      updateFileNotes(fileId, savedNotes, noteNamesToDelete);
      setOriginalNoteNames(new Set(Object.keys(savedNotes)));
      setDirty(false);
      setEditing(false);
      addToast("Annotations saved.", "success");
    } catch (e) {
      addToast(`Failed to save annotations: ${e}`, "error");
    } finally {
      setSaving(false);
    }
  }, [fileId, annotations, originalNoteNames, updateFileNotes, addToast]);

  const startTranscribe = useCallback(async () => {
    if (!provider) {
      addToast(
        "No model provider configured. You can add one in the Models tab of the settings.",
        "error",
      );
      return;
    }
    if (!fileData.width || !fileData.height) {
      addToast("Image dimensions unknown.", "error");
      return;
    }
    if (!provider.model) {
      addToast("The selected model provider has no model set.", "error");
      return;
    }
    const controller = new AbortController();
    transcribeAbort.current = controller;
    setTranscribing(true);
    try {
      const res = await fetch(sourceUrl, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const imgBlob = await res.blob();
      const impl = createProvider(provider);
      const imgW = fileData.width;
      const imgH = fileData.height;
      // Stream index -> local note id for this transcription run.
      const idByIndex = new Map<number, string>();
      let placeholderCount = 0;
      for await (const ev of impl.transcribe({
        blob: imgBlob,
        width: imgW,
        height: imgH,
        signal: controller.signal,
      })) {
        switch (ev.type) {
          case "box": {
            const id = idByIndex.get(ev.index);
            if (!id) {
              const note = newAnnotation(
                ev.box.x,
                ev.box.y,
                ev.box.width,
                ev.box.height,
                "",
                fileData.width,
                fileData.height,
              );
              idByIndex.set(ev.index, note.$id);
              setAnnotations((prev) => [...prev, note]);
            } else {
              setAnnotations((prev) =>
                prev.map((n) =>
                  n.$id === id ? { ...n, ...ev.box, $pending: false } : n,
                ),
              );
            }
            break;
          }
          case "text": {
            const id = idByIndex.get(ev.index);
            if (!id) {
              // No box yet: calculate placeholder
              const box = placeholderBox(placeholderCount++, imgW, imgH);
              const note = newAnnotation(
                box.x,
                box.y,
                box.width,
                box.height,
                ev.body,
                fileData.width,
                fileData.height,
              );
              idByIndex.set(ev.index, note.$id);
              note.$pending = true;
              setAnnotations((prev) => [...prev, note]);
            } else {
              setAnnotations((prev) =>
                prev.map((n) => (n.$id === id ? { ...n, body: ev.body } : n)),
              );
            }
            break;
          }
          case "end": {
            const id = idByIndex.get(ev.index);
            const note = ev.note;
            if (!id) {
              if (note)
                setAnnotations((prev) => [
                  ...prev,
                  newAnnotation(
                    note.x,
                    note.y,
                    note.width,
                    note.height,
                    note.body,
                    fileData.width!,
                    fileData.height!,
                  ),
                ]);
              break;
            }
            setAnnotations((prev) =>
              prev.map((n) =>
                n.$id === id
                  ? note
                    ? {
                        ...n,
                        ...note,
                        $pending: false,
                      }
                    : { ...n, $pending: false }
                  : n,
              ),
            );
            break;
          }
        }
        setDirty(true);
      }
      addToast("Transcription complete.", "success");
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        addToast("Transcription cancelled.", "info");
      } else {
        addToast(`Transcription failed: ${e}`, "error");
      }
    } finally {
      setTranscribing(false);
      transcribeAbort.current = null;
    }
  }, [fileData, provider, sourceUrl, addToast]);

  const cancelTranscribe = useCallback(() => {
    transcribeAbort.current?.abort();
  }, []);

  const showOverlay = visible || editing;

  const overlayTransform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;

  return (
    <>
      <div className="annotation-toolbar">
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          title={visible ? "Hide annotations" : "Show annotations"}
          className={`annotation-toolbar-button ${visible ? "active" : ""}`}
          disabled={annotations.length === 0 && !editing}
        >
          <ChatBubbleBottomCenterTextIcon />
        </button>
        {editing ? (
          <>
            <button
              type="button"
              onClick={addNote}
              title="Add note"
              className="annotation-toolbar-button"
              disabled={!fileData.width || !fileData.height}
            >
              <PlusIcon />
            </button>
            {transcribing ? (
              <button
                type="button"
                onClick={cancelTranscribe}
                title="Cancel transcription"
                className="annotation-toolbar-button active"
              >
                <SparklesIcon className="pulse" />
              </button>
            ) : (
              <button
                type="button"
                onClick={startTranscribe}
                title="Transcribe text in image"
                className="annotation-toolbar-button"
                disabled={!provider}
              >
                <SparklesIcon />
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving || transcribing}
              className="annotation-toolbar-text-button"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (transcribing) cancelTranscribe();
                setEditing(false);
                const annotations = deserializeAnnotations(fileData);
                setAnnotations(annotations);
                setDirty(false);
              }}
              className="annotation-toolbar-text-button"
            >
              Done
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setVisible(true);
            }}
            className="annotation-toolbar-text-button"
          >
            Edit
          </button>
        )}
      </div>
      {showOverlay && (
        <div
          className={`annotation-overlay ${editing ? "editing" : ""}`}
          style={{
            width: `${displayWidth}px`,
            height: `${displayHeight}px`,
            transform: overlayTransform,
          }}
        >
          {annotations.map((note) => (
            <NoteBox
              key={note.$id}
              note={note}
              displayWidth={displayWidth}
              displayHeight={displayHeight}
              displayScale={scale}
              editing={editing}
              onChange={(patch) => updateAnnotation(note.$id, patch)}
              onRemove={() => removeAnnotation(note.$id)}
            />
          ))}
        </div>
      )}
    </>
  );
};

interface NoteBoxProps {
  note: LocalAnnotation;
  displayWidth: number;
  displayHeight: number;
  displayScale: number;
  editing: boolean;
  onChange: (patch: Partial<LocalAnnotation>) => void;
  onRemove: () => void;
}

type DragMode = "move" | "resize";

export const NoteBox: React.FC<NoteBoxProps> = ({
  note,
  displayWidth,
  displayHeight,
  displayScale,
  editing,
  onChange,
  onRemove,
}) => {
  const scaleX = note.imageWidth ? displayWidth / note.imageWidth : 1;
  const scaleY = note.imageHeight ? displayHeight / note.imageHeight : 1;
  const textRef = useRef<HTMLElement | null>(null);
  const setTextRef = useCallback(
    (element: HTMLDivElement | HTMLTextAreaElement | null) => {
      textRef.current = element;
    },
    [],
  );

  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    orig: Annotation;
  } | null>(null);

  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element) return;
    fitAnnotationFontSize(element, note.body);
  }, [editing, note.body, note.height, note.width, scaleX, scaleY]);

  const onPointerDown =
    (mode: DragMode) => (e: React.PointerEvent<HTMLDivElement>) => {
      if (!editing) return;
      e.stopPropagation();
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        mode,
        startX: e.clientX,
        startY: e.clientY,
        orig: { ...note },
      };
    };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.stopPropagation();
    const sx = scaleX * displayScale;
    const sy = scaleY * displayScale;
    if (sx === 0 || sy === 0) return;
    const dx = (e.clientX - drag.startX) / sx;
    const dy = (e.clientY - drag.startY) / sy;
    if (drag.mode === "move") {
      onChange({ x: drag.orig.x + dx, y: drag.orig.y + dy });
    } else {
      onChange({
        width: Math.max(8, drag.orig.width + dx),
        height: Math.max(8, drag.orig.height + dy),
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    dragRef.current = null;
  };

  return (
    <div
      className={`annotation-note ${note.$pending ? "pending" : ""}`}
      style={{
        left: `${note.x * scaleX}px`,
        top: `${note.y * scaleY}px`,
        width: `${note.width * scaleX}px`,
        height: `${note.height * scaleY}px`,
      }}
    >
      {editing && (
        <div
          className="annotation-note-handle"
          onPointerDown={onPointerDown("move")}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <button
            type="button"
            className="annotation-note-remove"
            title="Remove note"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            onPointerDown={stopEventPropagation}
          >
            <TrashIcon />
          </button>
        </div>
      )}
      {/* TODO: is there a less ugly way to prevent propagation here? */}
      {editing ? (
        <textarea
          ref={setTextRef}
          className="annotation-note-text"
          value={note.body}
          onPointerDown={stopEventPropagation}
          onClick={stopEventPropagation}
          onMouseDown={stopEventPropagation}
          onTouchStart={stopEventPropagation}
          onTouchMove={stopEventPropagation}
          onTouchEnd={stopEventPropagation}
          onTouchCancel={stopEventPropagation}
          onWheel={stopEventPropagation}
          onChange={(e) => onChange({ body: e.currentTarget.value })}
        />
      ) : (
        <div
          ref={setTextRef}
          className="annotation-note-text"
          onPointerDown={stopEventPropagation}
          onClick={stopEventPropagation}
          onTouchStart={stopEventPropagation}
          onTouchMove={stopEventPropagation}
          onTouchEnd={stopEventPropagation}
          onTouchCancel={stopEventPropagation}
          onWheel={stopEventPropagation}
        >
          {note.body}
        </div>
      )}
      {editing && (
        <div
          className="annotation-note-resize"
          onPointerDown={onPointerDown("resize")}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      )}
    </div>
  );
};

export default AnnotationOverlay;
