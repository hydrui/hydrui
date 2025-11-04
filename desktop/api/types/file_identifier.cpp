#include "file_identifier.h"
#include "serialization.h"
#include <QJsonObject>

namespace Hydrui::API {

void FileIdentifier::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap(2);
    writer.append("file_id");
    writer.append(fileId);
    writer.append("hash");
    writer.append(hash);
    writer.endMap();
}

void FileIdentifier::readFromCbor(QCborStreamReader& reader) {
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
        if (key == "file_id" && reader.isInteger()) {
            fileId = reader.toInteger();
        } else if (key == "hash" && reader.isString()) {
            hash = readCompleteString(reader);
        } else {
            reader.next();
        }
    }
}

QJsonObject FileIdentifier::toJson() const {
    QJsonObject obj;
    obj["file_id"] = fileId;
    obj["hash"] = hash;
    return obj;
}

void FileIdentifier::fromJson(const QJsonObject& json) {
    fileId = json["file_id"].toInt();
    hash = json["hash"].toString();
}

} // namespace Hydrui::API
