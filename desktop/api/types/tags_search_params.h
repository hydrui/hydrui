#pragma once

#include "file_domain_param.h"
#include "interfaces.h"
#include <QString>
#include <optional>

namespace Hydrui::API {

struct TagsSearchParams : public IUrlParams {
    FileDomainParam domain;
    std::optional<QString> search;
    std::optional<QString> tagServiceKey;
    std::optional<QString> tagDisplayType;

    QUrlQuery toUrlQuery() const override;
    void fromUrlQuery(const QUrlQuery& query) override;
};

} // namespace Hydrui::API
