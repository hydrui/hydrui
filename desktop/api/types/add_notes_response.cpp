#include "add_notes_response.h"
#include "serialization.h"

namespace Hydrui::API {

void AddNotesResponse::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    writer.append("notes");
    writer.startMap();
    for (auto it = notes.begin(); it != notes.end(); ++it) {
        writer.append(it.key());
        writer.append(it.value());
    }
    writer.endMap();
    writer.endMap();
}

std::expected<void, QCborError> AddNotesResponse::readFromCbor(QCborStreamReader& reader) {
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
            } else {
                reader.next();
            }
        }
    } catch (QCborError error) {
        return std::unexpected(error);
    }
}

QJsonObject AddNotesResponse::toJson() const {
    QJsonObject obj;
    QJsonObject notesObj;
    for (auto it = notes.begin(); it != notes.end(); ++it) {
        notesObj[it.key()] = it.value();
    }
    obj["notes"] = notesObj;
    return obj;
}

void AddNotesResponse::fromJson(const QJsonObject& json) {
    notes.clear();
    QJsonObject notesObj = json["notes"].toObject();
    for (auto it = notesObj.begin(); it != notesObj.end(); ++it) {
        notes[it.key()] = it.value().toString();
    }
}

} // namespace Hydrui::API
