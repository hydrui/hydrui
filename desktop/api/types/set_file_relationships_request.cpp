#include "set_file_relationships_request.h"
#include "serialization.h"
#include <QJsonArray>

namespace Hydrui::API {

void SetFileRelationshipsRequest::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    writer.append("relationships");
    writer.startArray(relationships.size());
    for (const auto& rel : relationships) {
        rel.writeToCbor(writer);
    }
    writer.endArray();
    writer.endMap();
}

std::expected<void, QCborError> SetFileRelationshipsRequest::readFromCbor(QCborStreamReader& reader) {
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
            if (key == "relationships" && reader.isArray()) {
                relationships.clear();
                reader.enterContainer();
                for (;;) {
                    if (!reader.hasNext()) {
                        reader.leaveContainer();
                        break;
                    }
                    FileRelationshipPair rel;
                    rel.readFromCbor(reader);
                    relationships.append(rel);
                }
            } else {
                reader.next();
            }
        }
    } catch (QCborError error) {
        return std::unexpected(error);
    }
}

QJsonObject SetFileRelationshipsRequest::toJson() const {
    QJsonObject obj;
    QJsonArray relsArray;
    for (const auto& rel : relationships) {
        relsArray.append(rel.toJson());
    }
    obj["relationships"] = relsArray;
    return obj;
}

void SetFileRelationshipsRequest::fromJson(const QJsonObject& json) {
    relationships.clear();
    QJsonArray relsArray = json["relationships"].toArray();
    for (const auto& val : relsArray) {
        FileRelationshipPair rel;
        rel.fromJson(val.toObject());
        relationships.append(rel);
    }
}

} // namespace Hydrui::API
