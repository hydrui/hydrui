#include "associate_url_request.h"
#include "serialization.h"

namespace Hydrui::API {

void AssociateUrlRequest::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    files.writeToCbor(writer);
    writer.append("urls_to_add");
    writeStringArray(writer, urlsToAdd);
    writer.append("urls_to_delete");
    writeStringArray(writer, urlsToDelete);
    writer.append("normalise_urls");
    writer.append(normaliseUrls);
    writer.endMap();
}

std::expected<void, QCborError> AssociateUrlRequest::readFromCbor(QCborStreamReader& reader) {
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
            if (key == "urls_to_add" && reader.isArray()) {
                readStringArray(reader, urlsToAdd);
            } else if (key == "urls_to_delete" && reader.isArray()) {
                readStringArray(reader, urlsToDelete);
            } else if (key == "normalise_urls" && reader.isBool()) {
                normaliseUrls = reader.toBool();
            } else {
                reader.next();
            }
        }
    } catch (QCborError error) {
        return std::unexpected(error);
    }
}

QJsonObject AssociateUrlRequest::toJson() const {
    QJsonObject obj = files.toJson();
    obj["urls_to_add"] = stringListToJson(urlsToAdd);
    obj["urls_to_delete"] = stringListToJson(urlsToDelete);
    obj["normalise_urls"] = normaliseUrls;
    return obj;
}

void AssociateUrlRequest::fromJson(const QJsonObject& json) {
    files.fromJson(json);
    urlsToAdd = jsonToStringVector(json["urls_to_add"].toArray());
    urlsToDelete = jsonToStringVector(json["urls_to_delete"].toArray());
    normaliseUrls = json["normalise_urls"].toBool();
}

} // namespace Hydrui::API
