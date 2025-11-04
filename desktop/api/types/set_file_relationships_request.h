#pragma once

#include "file_relationship_pair.h"
#include "interfaces.h"
#include <QJsonObject>
#include <QVector>

namespace Hydrui::API {

struct SetFileRelationshipsRequest : public IRequestResponseBody {
    QVector<FileRelationshipPair> relationships;

    void writeToCbor(QCborStreamWriter& writer) const override;
    std::expected<void, QCborError> readFromCbor(QCborStreamReader& reader) override;
    QJsonObject toJson() const override;
    void fromJson(const QJsonObject& json) override;
};

} // namespace Hydrui::API
