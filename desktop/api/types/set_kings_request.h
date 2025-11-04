#pragma once

#include "files_param.h"
#include "interfaces.h"

namespace Hydrui::API {

struct SetKingsRequest : public IRequestResponseBody {
    FilesParam files;

    void writeToCbor(QCborStreamWriter& writer) const override;
    std::expected<void, QCborError> readFromCbor(QCborStreamReader& reader) override;
    QJsonObject toJson() const override;
    void fromJson(const QJsonObject& json) override;
};

} // namespace Hydrui::API
