# Static site

Hydrui can be deployed as a static site in client-only mode. This is essentially identical to the hosted version, minus the landing pages.

Some static site hosting providers are supported directly, but any static site hosting provider should work provided you can build the assets. You can also host the static assets on your own machines with almost any static file server.

## Using Netlify

[![Deploy to Netlify](/assets/images/deploy-to-netlify.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/hydrui/hydrui)

## Using DigitalOcean

[![Deploy to DO](/assets/images/deploy-to-digitalocean.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/hydrui/hydrui/tree/main)

## Manually

Build the Hydrui Client:

```
npm run build
```

The static files will be saved into the `dist` folder. You can upload these to your static file server.

### Add a Content Security Policy

Adding a CSP header is optional, but will marginally improve the security posture of Hydrui. With client-only mode, the following CSP settings should be sufficient:

```
default-src 'none';
script-src 'self' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline';
connect-src *;
img-src *;
media-src *;
frame-ancestors 'none';
base-uri 'self';
```

(`connect-src`, `img-src` and `media-src` need to be `*` in client-only mode for communicating with the hydrus network client API. `wasm-unsafe-eval` is needed in `script-src` for Ruffle. If you want to improve this somewhat, you can replace `*` with an appropriate rule that will only match the hydrus network client API origins you wish to be able to connect to.)

If you want to apply this header with nginx, you could use the following directive:

```nginx
add_header Content-Security-Policy "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src *; img-src *; media-src *; frame-ancestors 'none'; base-uri 'self';";
```

You can add an [`add_header`](https://nginx.org/en/docs/http/ngx_http_headers_module.html) directive in an `http`, `server` or `location` block.
