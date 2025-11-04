#include "refresh_page_request.h"
#include "serialization.h"

namespace Hydrui::API {

void RefreshPageRequest::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    writer.append("page_key");
    writer.append(pageKey);
    writer.endMap();
}

std::expected<void, QCborError> RefreshPageRequest::readFromCbor(QCborStreamReader& reader) {
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
            if (key == "page_key" && reader.isString()) {
                pageKey = readCompleteString(reader);
            } else {
                reader.next();
            }
        }
    } catch (QCborError error) {
        return std::unexpected(error);
    }
}

QJsonObject RefreshPageRequest::toJson() const {
    QJsonObject obj;
    obj["page_key"] = pageKey;
    return obj;
}

void RefreshPageRequest::fromJson(const QJsonObject& json) {
    pageKey = json["page_key"].toString();
}

} // namespace Hydrui::API
