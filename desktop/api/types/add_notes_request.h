#pragma once

#include "files_param.h"
#include "interfaces.h"
#include <QMap>
#include <QString>
#include <optional>

namespace Hydrui::API {

struct AddNotesRequest : public IRequestResponseBody {
    QMap<QString, QString> notes;
    FilesParam files;
    std::optional<bool> mergeCleverly;
    std::optional<bool> extendExistingNoteIfPossible;
    std::optional<int> conflictResolution;

    void writeToCbor(QCborStreamWriter& writer) const override;
    std::expected<void, QCborError> readFromCbor(QCborStreamReader& reader) override;
    QJsonObject toJson() const override;
    void fromJson(const QJsonObject& json) override;
};

} // namespace Hydrui::API
