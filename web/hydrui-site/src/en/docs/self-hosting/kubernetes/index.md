# Kubernetes

Hydrui includes some manifests that you can use with Kubernetes. You first need to grab a copy of the [source code](https://github.com/hydrui/hydrui). The Kubernetes manifests can be found in the [`deploy/kubernetes`](https://github.com/hydrui/hydrui/tree/master/deploy/kubernetes) folder.

Please note that a [Helm Chart](./helm) is also available.

There is more documentation alongside the Kubernetes manifests for how to use them. Here is a basic example of how you can use the included Kubernetes manifests to deploy a client-only copy of Hydrui locally:

```console
$ cd deploy/kubernetes/client-only
$ kubectl apply -k .
...
```
