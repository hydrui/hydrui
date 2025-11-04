#include "file_relationship_pair.h"
#include "serialization.h"

namespace Hydrui::API {

void FileRelationshipPair::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    writer.append("hash_a");
    writer.append(hashA);
    writer.append("hash_b");
    writer.append(hashB);
    writer.append("relationship");
    writer.append(relationship);
    writer.append("do_default_content_merge");
    writer.append(doDefaultContentMerge);
    if (deleteA.has_value()) {
        writer.append("delete_a");
        writer.append(*deleteA);
    }
    if (deleteB.has_value()) {
        writer.append("delete_b");
        writer.append(*deleteB);
    }
    writer.endMap();
}

void FileRelationshipPair::readFromCbor(QCborStreamReader& reader) {
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
        if (key == "hash_a" && reader.isString()) {
            hashA = readCompleteString(reader);
        } else if (key == "hash_b" && reader.isString()) {
            hashB = readCompleteString(reader);
        } else if (key == "relationship" && reader.isInteger()) {
            relationship = reader.toInteger();
        } else if (key == "do_default_content_merge" && reader.isBool()) {
            doDefaultContentMerge = reader.toBool();
        } else if (key == "delete_a" && reader.isBool()) {
            deleteA = reader.toBool();
        } else if (key == "delete_b" && reader.isBool()) {
            deleteB = reader.toBool();
        } else {
            reader.next();
        }
    }
}

QJsonObject FileRelationshipPair::toJson() const {
    QJsonObject obj;
    obj["hash_a"] = hashA;
    obj["hash_b"] = hashB;
    obj["relationship"] = relationship;
    obj["do_default_content_merge"] = doDefaultContentMerge;
    if (deleteA.has_value()) {
        obj["delete_a"] = *deleteA;
    }
    if (deleteB.has_value()) {
        obj["delete_b"] = *deleteB;
    }
    return obj;
}

void FileRelationshipPair::fromJson(const QJsonObject& json) {
    hashA = json["hash_a"].toString();
    hashB = json["hash_b"].toString();
    relationship = json["relationship"].toInt();
    doDefaultContentMerge = json["do_default_content_merge"].toBool();
    if (json.contains("delete_a")) {
        deleteA = json["delete_a"].toBool();
    }
    if (json.contains("delete_b")) {
        deleteB = json["delete_b"].toBool();
    }
}

} // namespace Hydrui::API
