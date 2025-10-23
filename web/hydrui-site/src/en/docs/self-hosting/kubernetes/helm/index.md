# Helm Chart

Hydrui includes a Helm chart that you can use with Kubernetes. You first need to grab a copy of the [source code](https://github.com/hydrui/hydrui). The Helm chart can be found in the [`deploy/helm`](https://github.com/hydrui/hydrui/tree/master/deploy/helm) folder.

There is more documentation alongside the Helm chart for how to use it. Here is a basic example of how you can use the included Helm chart to deploy a client-only copy of Hydrui locally:

```console
$ helm install my-hydrui-instance deploy/helm/hydrui
...
```
