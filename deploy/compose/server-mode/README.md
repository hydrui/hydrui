# Hydrui Server Mode Docker Compose demo

This is a demo of using Docker Compose to deploy Hydrui in server mode alongside the hydrus network client.

The hydrus network client will be set up with the API key specified in `environment.txt`, and the hydrus network API client will be listening on plaintext HTTP on TCP port 45869. A noVNC server will be listening on port 5800 and an X11vnc server will be listening on port 5900. All of these ports will be forwarded to listen on all host network interfaces. You can view the hydrus network client interface via your browser at <http://localhost:5800>.

Hydrui will be started in server mode. It will be listening on port 8080 for the web interface. This port will be forwarded to listen on all host network interfaces. You can access Hydrui at <http://localhost:8080>. The username and password for access is admin/admin, and can be customized by editing the htpasswd.txt; see the [run locally](https://hydrui.dev/en/docs/self-hosting/run-locally/) documentation for more information.

You can copy and edit this configuration as needed.

## Deployment

To deploy Hydrui in server mode:

```bash
docker compose up
```

## Cleanup

To remove all resources:

```bash
docker compose rm
```

Note that this will not delete volumes by default. You can delete volumes as well by passing the `--volumes` option to `docker compose rm`.
