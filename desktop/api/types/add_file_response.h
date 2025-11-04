#pragma once

#include "api_response.h"
#include "interfaces.h"
#include <QString>
#include <optional>

namespace Hydrui::API {

struct AddFileResponse : public IRequestResponseBody {
    ApiResponse base;
    int status = 0;
    QString hash;
    QString note;
    std::optional<QString> traceback;

    void writeToCbor(QCborStreamWriter& writer) const override;
    std::expected<void, QCborError> readFromCbor(QCborStreamReader& reader) override;
    QJsonObject toJson() const override;
    void fromJson(const QJsonObject& json) override;
};

} // namespace Hydrui::API
