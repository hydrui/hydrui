import {
  MinusIcon,
  PencilSquareIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import { FocusTrap } from "focus-trap-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { FileMetadata } from "@/api/types";
import ConfirmModal from "@/components/modals/ConfirmModal/ConfirmModal";
import EditNoteModal from "@/components/modals/EditNoteModal/EditNoteModal";
import PushButton from "@/components/widgets/PushButton/PushButton";
import { useShortcut } from "@/hooks/useShortcut";
import { client } from "@/store/apiStore";
import { usePageActions } from "@/store/pageStore";

import "./index.css";

interface EditNotesModalProps {
  file: FileMetadata;
  onClose: () => void;
}

type NoteMap = Map<string, string>;

type TabType = "edit" | "summary";

const EditNotesModal: React.FC<EditNotesModalProps> = ({ file, onClose }) => {
  const { refreshFileMetadata } = usePageActions();
  const [activeTab, setActiveTab] = useState<TabType>("edit");
  const [initialNotes, setInitialNotes] = useState<NoteMap>(new Map());
  const [notes, setNotes] = useState<[string, string][]>([]);
  const [notesToAdd, setNotesToAdd] = useState<NoteMap>(new Map());
  const [notesToEdit, setNotesToEdit] = useState<NoteMap>(new Map());
  const [notesToRemove, setNotesToRemove] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editText, setEditText] = useState("");
  const [editIsNew, setEditIsNew] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file.notes) return;
    const noteEntries = Object.entries(file.notes);
    setNotes(noteEntries);
    setInitialNotes(new Map(noteEntries));
  }, [file]);

  // Handle actions
  const handleAddNote = useCallback(
    (name: string, text: string) => {
      if (initialNotes.has(name)) {
        if (notesToRemove.has(name)) {
          setNotesToRemove((prev) => {
            const newSet = new Set(prev);
            newSet.delete(name);
            return newSet;
          });
        }
        if (initialNotes.get(name) !== text) {
          setNotesToEdit((prev) => {
            const newMap = new Map(prev);
            newMap.set(name, text);
            return newMap;
          });
        }
      } else {
        setNotesToAdd((prev) => {
          const newMap = new Map(prev);
          newMap.set(name, text);
          return newMap;
        });
      }
      setNotes((prev) => {
        const newNotes = [...prev];
        const noteIndex = prev.findIndex(([noteName]) => noteName === name);
        if (noteIndex !== -1) {
          newNotes[noteIndex][1] = text;
        } else {
          newNotes.push([name, text]);
        }
        return newNotes;
      });
    },
    [initialNotes, notesToRemove],
  );

  const handleRemoveNote = useCallback(
    (name: string) => {
      if (initialNotes.has(name)) {
        setNotesToRemove((prev) => {
          const newSet = new Set(prev);
          newSet.add(name);
          return newSet;
        });
      } else {
        setNotesToAdd((prev) => {
          const newMap = new Map(prev);
          newMap.delete(name);
          return newMap;
        });
        setNotesToEdit((prev) => {
          const newMap = new Map(prev);
          newMap.delete(name);
          return newMap;
        });
      }
      setNotes((prev) => {
        return prev.filter(([noteName]) => noteName !== name);
      });
    },
    [initialNotes],
  );

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (
      notesToAdd.size === 0 &&
      notesToEdit.size === 0 &&
      notesToRemove.size === 0
    ) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // First, remove notes that were removed.
      await client.deleteNotes({
        file_id: file.file_id,
        note_names: Array.from(notesToRemove),
      });

      // Next, add new notes and edit changed notes.
      await client.addNotes({
        file_id: file.file_id,
        notes: {
          ...Object.fromEntries(notesToAdd),
          ...Object.fromEntries(notesToEdit),
        },
        conflict_resolution: 0,
      });

      // Finally, refresh metadata for the affected files.
      await refreshFileMetadata([file.file_id]);

      onClose();
    } catch (error) {
      console.error("Failed to update notes:", error);
      setError(
        error instanceof Error ? error.message : "Failed to update notes",
      );
      setIsSubmitting(false);
    }
  }, [
    file.file_id,
    notesToEdit,
    notesToRemove,
    notesToAdd,
    onClose,
    refreshFileMetadata,
  ]);

  const editNote = useCallback((name: string, text: string, isNew: boolean) => {
    setEditName(name);
    setEditText(text);
    setEditIsNew(isNew);
    setShowEditModal(true);
  }, []);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!inputRef.current) return;

      if (e.key === "Enter") {
        e.preventDefault();
        editNote(inputRef.current.value, "", true);
        inputRef.current.value = "";
      }
    },
    [editNote],
  );

  const handleClose = useCallback(() => {
    if (
      notesToAdd.size === 0 &&
      notesToEdit.size === 0 &&
      notesToRemove.size === 0
    ) {
      onClose();
    } else {
      setShowDiscardModal(true);
    }
  }, [onClose, notesToAdd.size, notesToEdit.size, notesToRemove.size]);

  useShortcut({
    Escape: handleClose,
  });

  return (
    <FocusTrap focusTrapOptions={{ allowOutsideClick: true }}>
      <div className="edit-notes-modal-container">
        <div className="edit-notes-modal-wrapper">
          <div className="edit-notes-modal-backdrop" onClick={handleClose} />

          <div className="edit-notes-modal-content">
            {/* Header */}
            <div className="edit-notes-modal-header">
              <h2 className="edit-notes-modal-title">Edit Notes</h2>
              <button
                onClick={handleClose}
                className="edit-notes-modal-close-button"
              >
                <XMarkIcon className="edit-notes-modal-close-icon" />
              </button>
            </div>

            {/* Tabs */}
            <div className="edit-notes-modal-tabs">
              <div className="edit-notes-modal-tabs-list">
                <button
                  onClick={() => setActiveTab("edit")}
                  className={`edit-notes-modal-tab ${
                    activeTab === "edit"
                      ? "edit-notes-modal-tab-active"
                      : "edit-notes-modal-tab-inactive"
                  }`}
                >
                  Edit Notes
                </button>
                <button
                  onClick={() => setActiveTab("summary")}
                  className={`edit-notes-modal-tab ${
                    activeTab === "summary"
                      ? "edit-notes-modal-tab-active"
                      : "edit-notes-modal-tab-inactive"
                  }`}
                >
                  Summary
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="edit-notes-modal-content-area">
              {activeTab === "edit" ? (
                <>
                  {/* Note name input */}
                  <div className="edit-notes-modal-name-input-container">
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="Enter a note name..."
                      className="edit-notes-modal-name-input"
                      disabled={isSubmitting}
                      onKeyDown={handleInputKeyDown}
                    />
                  </div>
                  {/* Note list */}
                  <div className="edit-notes-modal-note-list">
                    {notes.length === 0 ? (
                      <div className="edit-notes-modal-empty-message">
                        No notes
                      </div>
                    ) : (
                      <div className="edit-notes-modal-note-items">
                        {notes.map(([name, text]) => {
                          return (
                            <div
                              key={name}
                              className={`edit-notes-modal-note-item ${
                                notesToAdd.has(name)
                                  ? "edit-notes-modal-note-item-add"
                                  : notesToRemove.has(name)
                                    ? "edit-notes-modal-note-item-remove"
                                    : notesToEdit.has(name)
                                      ? "edit-notes-modal-note-item-edit"
                                      : ""
                              }`}
                            >
                              <div className="edit-notes-modal-note-value">
                                {name}
                              </div>
                              <div className="edit-notes-modal-name-item-right">
                                <button
                                  onClick={() => editNote(name, text, false)}
                                  className="edit-notes-modal-note-edit-button"
                                  title="Add to all files"
                                >
                                  <PencilSquareIcon />
                                </button>
                                <button
                                  onClick={() => handleRemoveNote(name)}
                                  className="edit-notes-modal-note-remove-button"
                                  title="Remove from all files"
                                >
                                  <MinusIcon />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Summary tab */
                <div className="edit-notes-modal-summary">
                  {notesToAdd.size + notesToRemove.size + notesToEdit.size ===
                  0 ? (
                    <div className="edit-notes-modal-empty-message">
                      No pending changes
                    </div>
                  ) : (
                    <div className="edit-notes-modal-changes-group">
                      {notesToAdd.size > 0 && (
                        <div className="edit-notes-modal-change-section">
                          <h4 className="edit-notes-modal-changes-title edit-notes-modal-changes-title-add">
                            Adding:
                          </h4>
                          <div className="edit-notes-modal-changes-list">
                            {Array.from(notesToAdd).map(([name]) => (
                              <div
                                key={name}
                                className="edit-notes-modal-change-item-add"
                              >
                                {name}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {notesToRemove.size > 0 && (
                        <div className="edit-notes-modal-change-section">
                          <h4 className="edit-notes-modal-changes-title edit-notes-modal-changes-title-remove">
                            Removing:
                          </h4>
                          <div className="edit-notes-modal-changes-list">
                            {Array.from(notesToRemove).map((name) => (
                              <div
                                key={name}
                                className="edit-notes-modal-change-item-remove"
                              >
                                {name}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {notesToEdit.size > 0 && (
                        <div className="edit-notes-modal-change-section">
                          <h4 className="edit-notes-modal-changes-title edit-notes-modal-changes-title-edit">
                            Editing:
                          </h4>
                          <div className="edit-notes-modal-changes-list">
                            {Array.from(notesToEdit).map(([name]) => (
                              <div
                                key={name}
                                className="edit-notes-modal-change-item-edit"
                              >
                                {name}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="edit-notes-modal-footer">
              <div className="edit-notes-modal-footer-content">
                {error ? (
                  <div className="edit-notes-modal-error">{error}</div>
                ) : (
                  <div className="edit-notes-modal-changes-count">
                    {notesToAdd.size + notesToRemove.size + notesToEdit.size}{" "}
                    pending change
                    {notesToAdd.size + notesToRemove.size + notesToEdit.size !==
                    1
                      ? "s"
                      : ""}
                  </div>
                )}

                <div className="edit-notes-modal-footer-buttons">
                  <PushButton
                    onClick={handleClose}
                    variant="secondary"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </PushButton>
                  <PushButton
                    onClick={handleSubmit}
                    disabled={
                      isSubmitting ||
                      notesToAdd.size +
                        notesToRemove.size +
                        notesToEdit.size ===
                        0
                    }
                    variant="primary"
                  >
                    {isSubmitting ? (
                      <span className="edit-notes-modal-spinner-container">
                        <div className="edit-notes-modal-spinner" />
                        Saving...
                      </span>
                    ) : (
                      "Save Changes"
                    )}
                  </PushButton>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Discard changes modal */}
        {showDiscardModal && (
          <ConfirmModal
            title="Discard Changes"
            message="You have unsaved changes. Are you sure you want to discard them?"
            confirmLabel="Discard"
            cancelLabel="Keep Editing"
            onConfirm={onClose}
            onCancel={() => setShowDiscardModal(false)}
          />
        )}

        {/* Edit note modal */}
        {showEditModal && (
          <EditNoteModal
            name={editName}
            text={editText}
            isNew={editIsNew}
            onSave={(name, text) => {
              handleAddNote(name, text);
              setShowEditModal(false);
            }}
            onCancel={() => setShowEditModal(false)}
          />
        )}
      </div>
    </FocusTrap>
  );
};

export default EditNotesModal;
