# Hydrui Server Mode Kubernetes Manifests

This is a set of Kubernetes manifests that deploy Hydrui in server mode, alongside the hydrus network client.

## What's Included

- `hydrui-deployment.yaml`: Deployment for Hydrui in server mode
- `hydrui-service.yaml`: Service exposing Hydrui web interface
- `hydrus-deployment.yaml`: Deployment for hydrus network client
- `hydrus-init-script.yaml`: ConfigMap with the Hydrus initialization script
- `hydrus-service.yaml`: Service exposing hydrus network API and VNC ports
- `pvc.yaml`: PersistentVolumeClaim for hydrus network database storage
- `secret.yaml`: Secret containing sensitive configuration (API keys, `.htpasswd`)

## Deployment

```bash
kubectl apply -k .
```

## Accessing the Services

The service is configured as `ClusterIP` by default, which makes it accessible only within the cluster. To access Hydrui from your local machine, you have several options:

### Accessing Hydrui Web Interface

#### Option 1: Port Forward

```bash
kubectl port-forward service/hydrui 8080:8080
```

Access Hydrui at <http://localhost:8080>. Log in with the credentials from your htpasswd file (default: `admin/admin`).

### Option 2: Override Service Type

You could create a Kustomize overlay to override the service from `ClusterIP` to `NodePort`, which will expose the service on a TCP port on the Kubernetes nodes. This is most suitable for simple Kubernetes deployments, especially single-node deployments.

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - <relative path to hydrui/deploy/kubernetes/server-mode>
patches:
  - target:
      kind: Service
      name: hydrui
    patch: |-
      - op: replace
        path: /spec/type
        value: NodePort
```

Apply the overlay:

```bash
kubectl apply -k <path to overlay>
```

Find the assigned NodePort:

```bash
kubectl get service hydrui
```

You can then access Hydrui at `http://<node-ip>:<node-port>`.

### Option 3: Use an Ingress

You can create an Ingress resource to expose Hydrui through your ingress controller. For example:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: hydrui
spec:
  rules:
    - host: hydrui.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: hydrui
                port:
                  number: 8080
```

If you are using Kustomize manifests, you can add this to your overlay.

### Accessing hydrus network VNC Interface

The Hydrus Network client GUI can be accessed via VNC, using kubectl port forwarding:

```bash
# noVNC web interface
kubectl port-forward service/hydrus 5800:5800

# Standard VNC
kubectl port-forward service/hydrus 5900:5900
```

Then, you can access the noVNC interface at <http://localhost:5800>.

## Customization

The cleanest way to customize these manifests would be to use Kustomize overlays. For more information, see the Kubernetes documentation regarding [bases and overlays](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/#bases-and-overlays).

For information about configuring Hydrui itself, see the [run locally](https://hydrui.dev/en/docs/self-hosting/run-locally/) documentation for more information.

## Cleanup

To remove all resources:

```bash
kubectl delete -k .
```

**Warning**: This will also delete the `PersistentVolumeClaim`! This will result in your hydrus network client database volume being destroyed.
