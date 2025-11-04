#pragma once

#include "files_param.h"
#include "interfaces.h"

namespace Hydrui::API {

struct GetFileRelationshipsParams : public IUrlParams {
    FilesParam files;

    QUrlQuery toUrlQuery() const override;
    void fromUrlQuery(const QUrlQuery& query) override;
};

} // namespace Hydrui::API
