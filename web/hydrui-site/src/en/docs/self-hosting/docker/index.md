# Docker

## Using the published image

You can use the OCI containers that are published via GitHub. Running them is very similar to running the CLI binary directly.

```console
docker run -p 8080:8080 --rm -it ghcr.io/hydrui/hydrui
```

The server should be accessible at <http://localhost:8080>.

Podman will also work here.

## Building from source

You can also build the OCI image from source. You need to grab a copy of the [source code](https://github.com/hydrui/hydrui), then in the source directory, run:

```console
docker build -t hydrui .
```

After a few minutes, the command should succeed, and you can now run the container you built.

```console
docker run --rm -it hydrui
```
