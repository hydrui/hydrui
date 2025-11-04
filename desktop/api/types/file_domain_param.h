#pragma once

#include <QJsonObject>
#include <QString>
#include <QUrlQuery>
#include <QVector>
#include <optional>

namespace Hydrui::API {

struct FileDomainParam {
    std::optional<QString> fileServiceKey;
    std::optional<QVector<QString>> fileServiceKeys;
    std::optional<QString> deletedFileServiceKey;
    std::optional<QVector<QString>> deletedFileServiceKeys;

    QUrlQuery toUrlQuery() const;
    void fromUrlQuery(const QUrlQuery& query);
    QJsonObject toJson() const;
    void fromJson(const QJsonObject& json);
};

} // namespace Hydrui::API
