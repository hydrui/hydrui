#include "dismiss_popup_request.h"
#include "serialization.h"

namespace Hydrui::API {

void DismissPopupRequest::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    writer.append("job_status_key");
    writer.append(jobStatusKey);
    writer.endMap();
}

std::expected<void, QCborError> DismissPopupRequest::readFromCbor(QCborStreamReader& reader) {
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
            if (key == "job_status_key" && reader.isString()) {
                jobStatusKey = readCompleteString(reader);
            } else {
                reader.next();
            }
        }
    } catch (QCborError error) {
        return std::unexpected(error);
    }
}

QJsonObject DismissPopupRequest::toJson() const {
    QJsonObject obj;
    obj["job_status_key"] = jobStatusKey;
    return obj;
}

void DismissPopupRequest::fromJson(const QJsonObject& json) {
    jobStatusKey = json["job_status_key"].toString();
}

} // namespace Hydrui::API
