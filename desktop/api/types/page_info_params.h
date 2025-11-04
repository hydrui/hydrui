#pragma once

#include "interfaces.h"
#include <QString>
#include <optional>

namespace Hydrui::API {

struct PageInfoParams : public IUrlParams {
    QString pageKey;
    std::optional<bool> simple;

    QUrlQuery toUrlQuery() const override;
    void fromUrlQuery(const QUrlQuery& query) override;
};

} // namespace Hydrui::API
