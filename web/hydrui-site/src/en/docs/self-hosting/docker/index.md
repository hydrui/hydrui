# Docker

## Using the published image

You can use the OCI containers that are published via GitHub. Running them is very similar to running the CLI binary directly.

```console
$ docker run -p 8080:8080 --rm -it ghcr.io/hydrui/hydrui
```

The server should be accessible at <http://localhost:8080>.

Podman will also work here.

You can run server-mode by passing the relevant configuration via flags:

```console
$ docker run \
    -v /var/hydrui/secret:/secret:ro \
    -v /var/hydrui/htpasswd:/htpasswd:ro \
    -v /var/hydrui/api-key:/api-key:ro \
    -p 8080:8080 \
    --rm -it ghcr.io/hydrui/hydrui \
    -secret-file=/secret \
    -htpasswd=/htpasswd \
    -hydrus-api-key-file=/api-key \
    -hydrus-url=[...] \
    -listen=:8080 \
    -secure=false \
    -server-mode
```

...Or, you can use environment variables:

```console
$ docker run \
    -v /var/hydrui/htpasswd:/htpasswd:ro \
    -p 8080:8080 \
    -e HYDRUI_SECRET=[...] \
    -e HYDRUI_HTPASSWD=/htpasswd \
    -e HYDRUI_HYDRUS_API_KEY=[...] \
    -e HYDRUI_HYDRUS_URL=[...] \
    -e HYDRUI_LISTEN=:8080 \
    -e HYDRUI_SECURE=false \
    -e HYDRUI_SERVER_MODE=true \
    --rm -it ghcr.io/hydrui/hydrui
```

See [run locally](../run-locally) for more information on the available flags and environment variables.

## Building from source

You can also build the OCI image from source. You need to grab a copy of the [source code](https://github.com/hydrui/hydrui), then in the source directory, run:

```console
docker build -t hydrui .
```

After a few minutes, the command should succeed, and you can now run the container you built.

```console
docker run --rm -it hydrui
```
