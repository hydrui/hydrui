# Hydrui Client-only Mode Kubernetes Manifests

This is a set of Kubernetes manifests that deploy Hydrui in client-only mode.

## What's Included

- `deployment.yaml`: Deployment for Hydrui in client-only mode
- `service.yaml`: ClusterIP service exposing Hydrui on port 8080

## Deployment

To deploy Hydrui in client-only mode:

```bash
kubectl apply -k .
```

## Accessing Hydrui

The service is configured as `ClusterIP` by default, which makes it accessible only within the cluster. To access Hydrui from your local machine, you have several options:

### Option 1: Port Forward

For testing, you can use kubectl port forwarding.

```bash
kubectl port-forward service/hydrui 8080:8080
```

You can then access Hydrui at <http://localhost:8080> on your local machine.

### Option 2: Override Service Type

You could create a Kustomize overlay to override the service from `ClusterIP` to `NodePort`, which will expose the service on a TCP port on the Kubernetes nodes. This is most suitable for simple Kubernetes deployments, especially single-node deployments.

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - <relative path to hydrui/deploy/kubernetes/client-only>
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

## Customization

The cleanest way to customize these manifests would be to use Kustomize overlays. For more information, see the Kubernetes documentation regarding [bases and overlays](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/#bases-and-overlays).

For information about configuring Hydrui itself, see the [run locally](https://hydrui.dev/en/docs/self-hosting/run-locally/) documentation for more information.

## Cleanup

To remove all resources:

```bash
kubectl delete -k .
```
