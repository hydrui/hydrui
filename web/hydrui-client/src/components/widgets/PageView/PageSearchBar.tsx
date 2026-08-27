import { useSearchStore } from "@/store/searchStore";

import { SearchBar } from "./SearchBar";

export const PageSearchBar: React.FC = () => {
  const {
    searchTags,
    searchSort,
    searchAscending,
    searchStatus,
    searchError,
    autoSearch,
    actions: {
      addSearchTag,
      removeSearchTag,
      setSearchSort,
      setSearchAscending,
      performSearch,
      setAutoSearch,
    },
  } = useSearchStore();

  return (
    <SearchBar
      searchTags={searchTags}
      addSearchTag={addSearchTag}
      removeSearchTag={removeSearchTag}
      controls={{
        searchSort,
        searchAscending,
        searchStatus,
        searchError,
        autoSearch,
        setSearchSort,
        setSearchAscending,
        performSearch,
        setAutoSearch,
      }}
    />
  );
};
