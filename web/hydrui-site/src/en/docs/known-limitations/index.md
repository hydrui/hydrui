# Known limitations

Hydrui has some limitations that may, at times, be counter-intuitive. Some of these limitations are simply issues with Hydrui that could be fixed with work, whereas some of the other limitations are a result of limitations with the hydrus network or other circumstances.

- **Hydrui can not create or destroy hydrus client pages.** This is an API limitation. Instead, it will just show them as-is. Hydrui will create "virtual" pages that don't show up within the hydrus network for operations where it is needed (e.g. finding similar files.)

- **Hydrui virtual pages are local-only and are lost if the `localStorage` is cleared.** It would be possible to resolve this, at least when using Hydrui Server.

- **Hydrui can not remove files from hydrus client pages.** This is an API limitation.

- **Hydrui uses heuristics to try to refresh tab contents, but tab contents may sometimes be stale**, especially when they are manipulated using the hydrus client interface, but even sometimes when using Hydrui to manipulate the tab (e.g. importing files.) This is an API limitation.

- Hydrui allows certain operations, like drag'n'drop and file upload to the current tab, including hydrus client pages. Note that the hydrus client API does not offer a single atomic operation that performs all of the steps that occur during an upload, so **if your client gets interrupted it is possible for uploaded files to get "lost".**

- Hydrui will show subscription job notifications, but **Hydrui can not yet perform actions like starting a gap downloader.**
