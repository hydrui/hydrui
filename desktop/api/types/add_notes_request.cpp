#include "add_notes_request.h"
#include "serialization.h"

namespace Hydrui::API {

void AddNotesRequest::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    writer.append("notes");
    writer.startMap();
    for (auto it = notes.begin(); it != notes.end(); ++it) {
        writer.append(it.key());
        writer.append(it.value());
    }
    writer.endMap();
    files.writeToCbor(writer);
    if (mergeCleverly.has_value()) {
        writer.append("merge_cleverly");
        writer.append(*mergeCleverly);
    }
    if (extendExistingNoteIfPossible.has_value()) {
        writer.append("extend_existing_note_if_possible");
        writer.append(*extendExistingNoteIfPossible);
    }
    if (conflictResolution.has_value()) {
        writer.append("conflict_resolution");
        writer.append(*conflictResolution);
    }
    writer.endMap();
}

std::expected<void, QCborError> AddNotesRequest::readFromCbor(QCborStreamReader& reader) {
    try {
        if (!reader.isMap()) {
            return {};
        }
        reader.enterContainer();
        for (;;) {
            if (!reader.hasNext()) {
                reader.leaveContainer();
                return {};
            }
            QString key = readCompleteString(reader);

            if (key == "notes" && reader.isMap()) {
                notes.clear();
                reader.enterContainer();
                for (;;) {
                    if (!reader.hasNext()) {
                        reader.leaveContainer();
                        break;
                    }
                    QString noteKey = readCompleteString(reader);
                    QString noteValue = readCompleteString(reader);
                    notes[noteKey] = noteValue;
                }
            } else if (key == "merge_cleverly" && reader.isBool()) {
                mergeCleverly = reader.toBool();
            } else if (key == "extend_existing_note_if_possible" && reader.isBool()) {
                extendExistingNoteIfPossible = reader.toBool();
            } else if (key == "conflict_resolution" && reader.isInteger()) {
                conflictResolution = reader.toInteger();
            } else {
                reader.next();
            }
        }
    } catch (QCborError error) {
        return std::unexpected(error);
    }
}

QJsonObject AddNotesRequest::toJson() const {
    QJsonObject obj = files.toJson();
    QJsonObject notesObj;
    for (auto it = notes.begin(); it != notes.end(); ++it) {
        notesObj[it.key()] = it.value();
    }
    obj["notes"] = notesObj;
    if (mergeCleverly.has_value()) {
        obj["merge_cleverly"] = *mergeCleverly;
    }
    if (extendExistingNoteIfPossible.has_value()) {
        obj["extend_existing_note_if_possible"] = *extendExistingNoteIfPossible;
    }
    if (conflictResolution.has_value()) {
        obj["conflict_resolution"] = *conflictResolution;
    }
    return obj;
}

void AddNotesRequest::fromJson(const QJsonObject& json) {
    files.fromJson(json);
    notes.clear();
    QJsonObject notesObj = json["notes"].toObject();
    for (auto it = notesObj.begin(); it != notesObj.end(); ++it) {
        notes[it.key()] = it.value().toString();
    }
    if (json.contains("merge_cleverly")) {
        mergeCleverly = json["merge_cleverly"].toBool();
    }
    if (json.contains("extend_existing_note_if_possible")) {
        extendExistingNoteIfPossible = json["extend_existing_note_if_possible"].toBool();
    }
    if (json.contains("conflict_resolution")) {
        conflictResolution = json["conflict_resolution"].toInt();
    }
}

} // namespace Hydrui::API
