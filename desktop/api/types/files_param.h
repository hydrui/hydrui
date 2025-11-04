#pragma once

#include <QCborStreamReader>
#include <QCborStreamWriter>
#include <QString>
#include <QUrlQuery>
#include <QVector>
#include <optional>

namespace Hydrui::API {

struct FilesParam {
    std::optional<int> fileId;
    std::optional<QVector<int>> fileIds;
    std::optional<QString> hash;
    std::optional<QVector<QString>> hashes;

    bool readCborKeyValuePair(QCborStreamReader& reader, QString key);

    void writeToCbor(QCborStreamWriter& writer) const;
    void readFromCbor(QCborStreamReader& reader);
    QJsonObject toJson() const;
    void fromJson(const QJsonObject& json);
    QUrlQuery toUrlQuery() const;
    void fromUrlQuery(const QUrlQuery& query);
};

} // namespace Hydrui::API
