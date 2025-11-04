#include "delete_notes_request.h"
#include "serialization.h"

namespace Hydrui::API {

void DeleteNotesRequest::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    writer.append("note_names");
    writeStringArray(writer, noteNames);
    files.writeToCbor(writer);
    writer.endMap();
}

std::expected<void, QCborError> DeleteNotesRequest::readFromCbor(QCborStreamReader& reader) {
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
            if (key == "note_names" && reader.isArray()) {
                readStringArray(reader, noteNames);
            } else {
                reader.next();
            }
        }
    } catch (QCborError error) {
        return std::unexpected(error);
    }
}

QJsonObject DeleteNotesRequest::toJson() const {
    QJsonObject obj = files.toJson();
    obj["note_names"] = stringListToJson(noteNames);
    return obj;
}

void DeleteNotesRequest::fromJson(const QJsonObject& json) {
    files.fromJson(json);
    noteNames = jsonToStringVector(json["note_names"].toArray());
}

} // namespace Hydrui::API
