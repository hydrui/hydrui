#pragma once

#include "files_param.h"
#include "interfaces.h"
#include <QMap>
#include <QString>
#include <QVector>
#include <optional>

namespace Hydrui::API {

using TagUpdate = QMap<int, QVector<QString>>; // action -> tags
using TagUpdates = QMap<QString, TagUpdate>;   // serviceKey -> TagUpdate

struct AddTagsRequest : public IRequestResponseBody {
    FilesParam files;
    TagUpdates serviceKeysToActionsToTags;
    std::optional<QMap<QString, QVector<QString>>> serviceKeysToTags;

    void writeToCbor(QCborStreamWriter& writer) const override;
    std::expected<void, QCborError> readFromCbor(QCborStreamReader& reader) override;
    QJsonObject toJson() const override;
    void fromJson(const QJsonObject& json) override;
};

} // namespace Hydrui::API
