#include "popups_response.h"
#include "serialization.h"
#include <QJsonArray>

namespace Hydrui::API {

void PopupsResponse::writeToCbor(QCborStreamWriter& writer) const {
    writer.startMap();
    writer.append("version");
    writer.append(base.version);
    writer.append("hydrus_version");
    writer.append(base.hydrusVersion);
    writer.append("job_statuses");
    writer.startArray(jobStatuses.size());
    for (const auto& job : jobStatuses) {
        job.writeToCbor(writer);
    }
    writer.endArray();
    writer.endMap();
}

std::expected<void, QCborError> PopupsResponse::readFromCbor(QCborStreamReader& reader) {
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
            } else if (key == "job_statuses" && reader.isArray()) {
                jobStatuses.clear();
                reader.enterContainer();
                for (;;) {
                    if (!reader.hasNext()) {
                        reader.leaveContainer();
                        break;
                    }
                    JobStatus job;
                    job.readFromCbor(reader);
                    jobStatuses.append(job);
                }
            } else {
                reader.next();
            }
        }
    } catch (QCborError error) {
        return std::unexpected(error);
    }
}

QJsonObject PopupsResponse::toJson() const {
    QJsonObject obj = base.toJson();
    QJsonArray jobsArray;
    for (const auto& job : jobStatuses) {
        jobsArray.append(job.toJson());
    }
    obj["job_statuses"] = jobsArray;
    return obj;
}

void PopupsResponse::fromJson(const QJsonObject& json) {
    base.fromJson(json);
    jobStatuses.clear();
    QJsonArray jobsArray = json["job_statuses"].toArray();
    for (const auto& val : jobsArray) {
        JobStatus job;
        job.fromJson(val.toObject());
        jobStatuses.append(job);
    }
}

} // namespace Hydrui::API
