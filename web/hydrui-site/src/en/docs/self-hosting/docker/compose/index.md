# Docker Compose

Hydrui includes some manifests that you can use with Docker Compose. You first need to grab a copy of the [source code](https://github.com/hydrui/hydrui). The Docker Compose manifests can be found in the [`deploy/compose`](https://github.com/hydrui/hydrui/tree/master/deploy/compose) folder.

There is more documentation alongside the Docker Compose files for how to use them. Here is a basic example of how you can use the included Docker Compose manifests to deploy a client-only copy of Hydrui locally:

```console
$ cd deploy/compose/client-only
$ docker compose up
...
```
