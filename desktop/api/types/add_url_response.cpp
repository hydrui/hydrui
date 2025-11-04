#include "add_url_response.h"
#include "serialization.h"

namespace Hydrui::API {

void AddUrlResponse::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    writer.append("version");
    writer.append(base.version);
    writer.append("hydrus_version");
    writer.append(base.hydrusVersion);
    writer.append("human_result_text");
    writer.append(humanResultText);
    writer.append("normalised_url");
    writer.append(normalisedUrl);
    writer.endMap();
}

std::expected<void, QCborError> AddUrlResponse::readFromCbor(QCborStreamReader& reader) {
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

            if (key == "version" && reader.isInteger()) {
                base.version = reader.toInteger();
            } else if (key == "hydrus_version" && reader.isInteger()) {
                base.hydrusVersion = reader.toInteger();
            } else if (key == "human_result_text" && reader.isString()) {
                humanResultText = readCompleteString(reader);
            } else if (key == "normalised_url" && reader.isString()) {
                normalisedUrl = readCompleteString(reader);
            } else {
                reader.next();
            }
        }
    } catch (QCborError error) {
        return std::unexpected(error);
    }
}

QJsonObject AddUrlResponse::toJson() const {
    QJsonObject obj = base.toJson();
    obj["human_result_text"] = humanResultText;
    obj["normalised_url"] = normalisedUrl;
    return obj;
}

void AddUrlResponse::fromJson(const QJsonObject& json) {
    base.fromJson(json);
    humanResultText = json["human_result_text"].toString();
    normalisedUrl = json["normalised_url"].toString();
}

} // namespace Hydrui::API
