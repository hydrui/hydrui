#pragma once

#include "files_param.h"
#include "interfaces.h"
#include <QString>
#include <QVariant>

namespace Hydrui::API {

struct SetRatingRequest : public IRequestResponseBody {
    FilesParam files;
    QString ratingServiceKey;
    QVariant rating; // Can be bool, number, or null

    void writeToCbor(QCborStreamWriter& writer) const override;
    std::expected<void, QCborError> readFromCbor(QCborStreamReader& reader) override;
    QJsonObject toJson() const override;
    void fromJson(const QJsonObject& json) override;
};

} // namespace Hydrui::API
