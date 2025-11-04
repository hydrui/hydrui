#include "page_info_response.h"
#include "serialization.h"

namespace Hydrui::API {

void PageInfoResponse::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    writer.append("version");
    writer.append(base.version);
    writer.append("hydrus_version");
    writer.append(base.hydrusVersion);
    writer.append("page_info");
    writer.startMap();
    writer.endMap();
    writer.endMap();
}

std::expected<void, QCborError> PageInfoResponse::readFromCbor(QCborStreamReader& reader) {
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
            } else if (key == "page_info") {
                pageInfo.readFromCbor(reader);
            } else {
                reader.next();
            }
        }
    } catch (QCborError error) {
        return std::unexpected(error);
    }
}

QJsonObject PageInfoResponse::toJson() const {
    QJsonObject obj = base.toJson();
    obj["page_info"] = pageInfo.toJson();
    return obj;
}

void PageInfoResponse::fromJson(const QJsonObject& json) {
    base.fromJson(json);
    pageInfo.fromJson(json["page_info"].toObject());
}

} // namespace Hydrui::API
