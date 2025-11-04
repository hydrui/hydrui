#pragma once

#include "interfaces.h"
#include <QString>
#include <QVector>
#include <optional>

namespace Hydrui::API {

struct AddFilesRequest : public IRequestResponseBody {
    std::optional<QVector<int>> fileIds;
    std::optional<QVector<QString>> hashes;
    QString pageKey;

    void writeToCbor(QCborStreamWriter& writer) const override;
    std::expected<void, QCborError> readFromCbor(QCborStreamReader& reader) override;
    QJsonObject toJson() const override;
    void fromJson(const QJsonObject& json) override;
};

} // namespace Hydrui::API
