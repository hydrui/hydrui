#include "page_info_params.h"

namespace Hydrui::API {

QUrlQuery PageInfoParams::toUrlQuery() const {
    QUrlQuery query;
    query.addQueryItem("page_key", pageKey);
    if (simple.has_value()) {
        query.addQueryItem("simple", *simple ? "true" : "false");
    }
    return query;
}

void PageInfoParams::fromUrlQuery(const QUrlQuery& query) {
    pageKey = query.queryItemValue("page_key");
    if (query.hasQueryItem("simple")) {
        simple = query.queryItemValue("simple") == "true";
    }
}

} // namespace Hydrui::API
