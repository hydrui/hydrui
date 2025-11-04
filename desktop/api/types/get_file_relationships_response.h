#pragma once

#include "file_relationship_info.h"
#include "interfaces.h"
#include <QMap>
#include <QString>

namespace Hydrui::API {

struct GetFileRelationshipsResponse : public IRequestResponseBody {
    QMap<QString, FileRelationshipInfo> fileRelationships;

    void writeToCbor(QCborStreamWriter& writer) const override;
    std::expected<void, QCborError> readFromCbor(QCborStreamReader& reader) override;
    QJsonObject toJson() const override;
    void fromJson(const QJsonObject& json) override;
};

} // namespace Hydrui::API
