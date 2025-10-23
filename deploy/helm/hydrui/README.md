# Hydrui Helm Chart

This Helm chart deploys Hydrui, and optionally hydrus network, on a Kubernetes cluster.

## Modes

This Helm chart supports three deployment modes:

1. **Client-Only Mode**: Deploys Hydrui to connect to the hydrus client API from the browser, just like the hosted service.
2. **Server-Bundled Mode**: Deploys Hydrui with a "bundled" hydrus network client instance.
3. **Server-External Mode**: Deploys Hydrui connected to an external hydrus network client instance.

## Configuration

For a complete list of parameters, see [values.yaml](values.yaml).

## Usage Examples

### Client-Only Mode (Default)

A basic client-only mode installation can be done using the default values:

```bash
helm install my-hydrui-instance hydrui/
```

### Server Mode with Bundled Hydrus

```yaml
# values-server-bundled.yaml
mode: server-bundled
serverMode:
  auth:
    enabled: true
    htpasswd:
      content: "admin:$2a$10$lq/aqnzpLksHhLVx.ZOxJOp20TZAhXJkoY41dGsTfpHLDQp22iPsq"
  hydrus:
    apiKey: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
hydrus:
  persistence:
    enabled: true
    size: 10Gi
    storageClass: standard
```

```bash
helm install my-hydrui hydrui/ -f values-server-bundled.yaml
```

### Server Mode with External Hydrus

Deploy Hydrui to connect to an existing hydrus network client using custom values:

```yaml
# values-server-external.yaml
mode: server-external
serverMode:
  auth:
    enabled: true
    htpasswd:
      content: "admin:$2a$10$lq/aqnzpLksHhLVx.ZOxJOp20TZAhXJkoY41dGsTfpHLDQp22iPsq"
  hydrus:
    url: "http://my-hydrus.example.com:45869"
    apiKey: "your-hydrus-api-key-here"
    secure: false
```

```bash
helm install my-hydrui hydrui/ -f values-server-external.yaml
```

### With Ingress and cert-manager

```yaml
mode: server-bundled
serverMode:
  auth:
    enabled: true
  security:
    secureCookies: true
hydrui:
  ingress:
    enabled: true
    className: nginx
    annotations:
      cert-manager.io/cluster-issuer: letsencrypt-prod
    hosts:
      - host: hydrui.example.com
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: hydrui-tls
        hosts:
          - hydrui.example.com
```

```bash
helm install my-hydrui hydrui/ -f values-with-ingress.yaml
```
