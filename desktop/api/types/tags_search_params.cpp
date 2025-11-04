#include "tags_search_params.h"

namespace Hydrui::API {

QUrlQuery TagsSearchParams::toUrlQuery() const {
    QUrlQuery query = domain.toUrlQuery();
    if (search.has_value()) {
        query.addQueryItem("search", *search);
    }
    if (tagServiceKey.has_value()) {
        query.addQueryItem("tag_service_key", *tagServiceKey);
    }
    if (tagDisplayType.has_value()) {
        query.addQueryItem("tag_display_type", *tagDisplayType);
    }
    return query;
}

void TagsSearchParams::fromUrlQuery(const QUrlQuery& query) {
    domain.fromUrlQuery(query);
    if (query.hasQueryItem("search")) {
        search = query.queryItemValue("search");
    }
    if (query.hasQueryItem("tag_service_key")) {
        tagServiceKey = query.queryItemValue("tag_service_key");
    }
    if (query.hasQueryItem("tag_display_type")) {
        tagDisplayType = query.queryItemValue("tag_display_type");
    }
}

} // namespace Hydrui::API
