# Hydrui Client-only Mode Docker Compose demo

This is a demo of using Docker Compose to deploy Hydrui in client-only mode.

Hydrui will be started in client-only mode. It will be listening on port 8080 for the web interface. This port will be forwarded to listen on all host network interfaces. You can access Hydrui at <http://localhost:8080>.

You can copy and edit this configuration as needed.

## Deployment

To deploy Hydrui in client-only mode:

```bash
docker compose up
```

## Cleanup

To remove all resources:

```bash
docker compose rm
```
