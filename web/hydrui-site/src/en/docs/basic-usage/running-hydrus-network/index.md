# Running hydrus network

Check out the [official documentation](https://hydrusnetwork.github.io/hydrus/getting_started_installing.html) for comprehensive information about installing hydrus network.

## With Docker

Here is a a quick one-liner for setting up the hydrus network using Docker in a way that exposes the API port:

```shell
docker run --name hydrusclient -d -p 5800:5800 -p 5900:5900 -p 45869:45869 ghcr.io/hydrusnetwork/hydrus:latest
```

> **Note:** This setup will store data in the container environment. If you want to durably store data, you will want to use [Docker volumes or bind mounts](https://spacelift.io/blog/docker-volumes).

Then, you can log into the NoVNC interface via <http://localhost:5800/>.

You need to set up an API key to use Hydrui with this installation. For that, check out the [Getting Started](../getting-started) page.
