#pragma once

#include "api_response.h"
#include "interfaces.h"
#include "page_info.h"

namespace Hydrui::API {

struct PageInfoResponse : public IRequestResponseBody {
    ApiResponse base;
    PageInfo pageInfo;

    void writeToCbor(QCborStreamWriter& writer) const override;
    std::expected<void, QCborError> readFromCbor(QCborStreamReader& reader) override;
    QJsonObject toJson() const override;
    void fromJson(const QJsonObject& json) override;
};

} // namespace Hydrui::API
