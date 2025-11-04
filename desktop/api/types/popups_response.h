#pragma once

#include "api_response.h"
#include "interfaces.h"
#include "job_status.h"
#include <QVector>

namespace Hydrui::API {

struct PopupsResponse : public IRequestResponseBody {
    ApiResponse base;
    QVector<JobStatus> jobStatuses;

    void writeToCbor(QCborStreamWriter& writer) const override;
    std::expected<void, QCborError> readFromCbor(QCborStreamReader& reader) override;
    QJsonObject toJson() const override;
    void fromJson(const QJsonObject& json) override;
};

} // namespace Hydrui::API
