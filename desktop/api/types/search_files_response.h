#pragma once

#include "api_response.h"
#include "interfaces.h"
#include <QString>
#include <QVector>
#include <optional>

namespace Hydrui::API {

struct SearchFilesResponse : public IRequestResponseBody {
    ApiResponse base;
    QVector<int> fileIds;
    std::optional<QVector<QString>> hashes;

    void writeToCbor(QCborStreamWriter& writer) const override;
    std::expected<void, QCborError> readFromCbor(QCborStreamReader& reader) override;
    QJsonObject toJson() const override;
    void fromJson(const QJsonObject& json) override;
};

} // namespace Hydrui::API
