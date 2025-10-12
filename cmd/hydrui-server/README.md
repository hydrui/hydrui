# Hydrui Server

A server to run Hydrui with some added security hardening. If you are worried about supply chain security or exploitable bugs in Hydrui or its dependencies, this server offers some additional defenses by greatly limiting what kinds of exfiltration is possible using Content Security Policy (CSP). It also offers a simple authentication system using the standard htpasswd file format (albeit only with bcrypt or SHA-1 hashes) which uses JWT-based session cookies. All XHR requests are same-site, so there is no CORS policy, ensuring that other websites on the Internet can't do anything interesting to the Hydrui server.

## Usage

```console
$ hydrui-server --hydrus-url=http://localhost:45869
```

## Creating htpasswd Files

You can create htpasswd files using the Apache `htpasswd` utility:

```console
$ # Create a new file with a user
$ htpasswd -B -c /path/to/htpasswd username

$ # Add another user to an existing file
$ htpasswd -B /path/to/htpasswd another_username
```

## Health checking

By default, the Hydrui server does not expose a health checking endpoint, but the `-listen-internal` or `-socket-internal` option will expose a plaintext HTTP server over TCP or UNIX domain sockets respectively that includes a health checking endpoint at `/healthz`. The health check endpoint is intended to be used with platforms like Docker and Kubernetes, allowing them to determine if the server is functioning properly. It returns the HTTP code 200 and the text "OK" when it succeeds, otherwise it will return a 5xx error with a single-line string error. For example:

```console
$ hydrui-server -listen :8080 -listen-internal :5050 &
$ curl http://localhost:8080/healthz
404 page not found
$ curl http://localhost:5050/healthz
OK
```

When using server mode, it is possible to query for the hydrus client status by appending `?check_hydrus` to the URL. This will verify that the hydrus client API is accessible and that the API key is valid. Since this round-trips the hydrus client API, you may want to have a more lax timeout and longer interval for this check.

```console
$ curl http://localhost:5050/healthz\?check_hydrus
Hydrus API returned failure: Did not find an entry for that access key!
```
