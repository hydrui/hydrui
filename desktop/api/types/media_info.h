#pragma once

#include <QJsonObject>
#include <QVector>

namespace Hydrui::API {

struct MediaInfo {
    int numFiles = 0;
    QVector<int> hashIds;

    QJsonObject toJson() const;
    void fromJson(const QJsonObject& json);
};

} // namespace Hydrui::API
