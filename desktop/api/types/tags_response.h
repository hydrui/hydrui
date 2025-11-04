#pragma once

#include "api_response.h"
#include "interfaces.h"
#include "tag_value.h"
#include <QVector>

namespace Hydrui::API {

struct TagsResponse : public IRequestResponseBody {
    ApiResponse base;
    QVector<TagValue> tags;

    void writeToCbor(QCborStreamWriter& writer) const override;
    std::expected<void, QCborError> readFromCbor(QCborStreamReader& reader) override;
    QJsonObject toJson() const override;
    void fromJson(const QJsonObject& json) override;
};

} // namespace Hydrui::API
