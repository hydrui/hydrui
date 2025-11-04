#include "file_relationship_info.h"
#include "serialization.h"

namespace Hydrui::API {

void FileRelationshipInfo::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    writer.append("is_king");
    writer.append(isKing);
    writer.append("king");
    writer.append(king);
    writer.append("king_is_on_file_domain");
    writer.append(kingIsOnFileDomain);
    writer.append("king_is_local");
    writer.append(kingIsLocal);
    writer.endMap();
}

void FileRelationshipInfo::readFromCbor(QCborStreamReader& reader) {
    if (!reader.isMap()) {
        return;
    }
    reader.enterContainer();
    for (;;) {
        if (!reader.hasNext()) {
            reader.leaveContainer();
            return;
        }
        QString key = readCompleteString(reader);
        if (key == "is_king" && reader.isBool()) {
            isKing = reader.toBool();
        } else if (key == "king" && reader.isString()) {
            king = readCompleteString(reader);
        } else if (key == "king_is_on_file_domain" && reader.isBool()) {
            kingIsOnFileDomain = reader.toBool();
        } else if (key == "king_is_local" && reader.isBool()) {
            kingIsLocal = reader.toBool();
        } else {
            reader.next();
        }
    }
}

QJsonObject FileRelationshipInfo::toJson() const {
    QJsonObject obj;
    obj["is_king"] = isKing;
    obj["king"] = king;
    obj["king_is_on_file_domain"] = kingIsOnFileDomain;
    obj["king_is_local"] = kingIsLocal;
    return obj;
}

void FileRelationshipInfo::fromJson(const QJsonObject& json) {
    isKing = json["is_king"].toBool();
    king = json["king"].toString();
    kingIsOnFileDomain = json.value("king_is_on_file_domain").toBool(true);
    kingIsLocal = json.value("king_is_local").toBool(true);
}

} // namespace Hydrui::API
