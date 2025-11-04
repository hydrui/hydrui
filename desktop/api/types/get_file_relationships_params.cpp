#include "get_file_relationships_params.h"

namespace Hydrui::API {

QUrlQuery GetFileRelationshipsParams::toUrlQuery() const {
    return files.toUrlQuery();
}

void GetFileRelationshipsParams::fromUrlQuery(const QUrlQuery& query) {
    files.fromUrlQuery(query);
}

} // namespace Hydrui::API
