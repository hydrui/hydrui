#pragma once

#include "media_info.h"
#include <QCborStreamReader>
#include <QCborStreamWriter>
#include <QCoroTask>
#include <QJsonObject>
#include <QMap>
#include <QString>
#include <QVariant>
#include <expected>
#include <optional>

namespace Hydrui::API {

struct PageInfo {
    QString name;
    QString pageKey;
    int pageState = 0;
    int pageType = 0;
    bool isMediaPage = false;
    std::optional<QMap<QString, QVariant>> management;
    std::optional<MediaInfo> media;

    void writeToCbor(QCborStreamWriter& writer) const;
    void readFromCbor(QCborStreamReader& reader);
    QJsonObject toJson() const;
    void fromJson(const QJsonObject& json);
};

} // namespace Hydrui::API
