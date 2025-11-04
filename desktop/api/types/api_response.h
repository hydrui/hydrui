#pragma once

#include <QJsonObject>

namespace Hydrui::API {

struct ApiResponse {
    int version{};
    int hydrusVersion{};

    QJsonObject toJson() const;
    void fromJson(const QJsonObject& json);
};

} // namespace Hydrui::API
