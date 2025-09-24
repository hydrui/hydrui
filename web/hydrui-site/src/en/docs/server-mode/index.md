# Server mode vs client-only mode

Hydrui has two primary modes of operation:

- **Client-only mode:** In this mode, Hydrui acts entirely as a pure frontend web application. There is no Hydrui server component; Hydrui connects _directly_ to the hydrus client API. This is how hosted Hydrui works.

- **Server mode:** In this mode, the Hydrui Server proxies the actual hydrus client API. This allows for improved mitigation against data exfiltration since the Hydrui client will not be allowed to make requests to any external servers using [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP). In _this_ mode, the server authenticates to the hydrus client itself, and Hydrui authenticates to the Hydrui Server, which provides traditional username/password-based authentication.

The main benefit of server mode is that it may be more convenient if you wish to run Hydrui alongside a copy of the hydrus client on your server.

Right now, there aren't any particular features that require the Hydrui Server. Once authenticated, the featureset of Hydrui is identical regardless of which mode you use. Also, when using the Hydrui Server, it is not mandatory to use this mode; Hydrui Server will default to client-only mode, since you'd need to explicitly specify API credentials anyways if you to use want server mode.
