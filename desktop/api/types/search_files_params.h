#pragma once

#include "file_domain_param.h"
#include "interfaces.h"
#include <QString>
#include <QVector>
#include <optional>

namespace Hydrui::API {

struct SearchFilesParams : public IUrlParams {
    FileDomainParam domain;
    QVector<QString> tags;
    std::optional<QString> tagServiceKey;
    std::optional<bool> includeCurrentTags;
    std::optional<bool> includePendingTags;
    std::optional<int> fileSortType;
    std::optional<bool> fileSortAsc;
    std::optional<bool> returnFileIds;
    std::optional<bool> returnHashes;

    QUrlQuery toUrlQuery() const override;
    void fromUrlQuery(const QUrlQuery& query) override;
};

} // namespace Hydrui::API
