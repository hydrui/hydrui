#pragma once

#include "files_param.h"
#include "interfaces.h"
#include <optional>

namespace Hydrui::API {

struct FileMetadataParams : public IUrlParams {
    FilesParam files;
    std::optional<bool> createNewFileIds;
    std::optional<bool> onlyReturnIdentifiers;
    std::optional<bool> onlyReturnBasicInformation;
    std::optional<bool> detailedUrlInformation;
    std::optional<bool> includeBlurhash;
    std::optional<bool> includeMilliseconds;
    std::optional<bool> includeNotes;
    std::optional<bool> includeServicesObject;

    QUrlQuery toUrlQuery() const override;
    void fromUrlQuery(const QUrlQuery& query) override;
};

} // namespace Hydrui::API
