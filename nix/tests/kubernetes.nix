{
  nixosTest,
  k3s,
  kubernetes-helm,
  testers,
}:
(testers.invalidateFetcherByDrvHash nixosTest {
  name = "hydrui-kubernetes";
  nodes.machine = {
    environment.systemPackages = [
      k3s
      kubernetes-helm
    ];
    services.k3s.enable = true;
    services.k3s.role = "server";
    services.k3s.package = k3s;
    services.k3s.extraFlags = [
      "--disable metrics-server"
      "--disable servicelb"
      "--disable traefik"
    ];
    virtualisation.docker.enable = true;
    virtualisation.diskSize = 8 * 1024;
    virtualisation.memorySize = 4 * 1024;
  };
  testScript = ''
    machine.wait_for_unit("k3s")

    with subtest("Docker container builds"):
      machine.succeed("mkdir -p /var/lib/rancher/k3s/agent/images/")
      machine.succeed("docker build -t ghcr.io/hydrui/hydrui:edge ${../..}")
      machine.succeed("docker save -o /var/lib/rancher/k3s/agent/images/hydrui.tar ghcr.io/hydrui/hydrui:edge")
      machine.wait_until_succeeds("k3s ctr images list | grep hydrui")

    with subtest("Client-only mode deployment"):
      machine.succeed("kubectl create namespace client-mode")
      machine.succeed("cd ${../../deploy/kubernetes}/client-only && kubectl apply -n client-mode -k .")
      machine.succeed("kubectl wait pods -n client-mode -l app=hydrui --for=condition=Ready --timeout=120s")
      machine.succeed("cd ${../../deploy/kubernetes}/client-only && kubectl delete -n client-mode -k .")

    with subtest("Client-only mode deployment + demo overlay"):
      machine.succeed("kubectl create namespace client-mode-overlay")
      machine.succeed("cd ${../../deploy/kubernetes}/client-only-demo-overlay && kubectl apply -n client-mode-overlay -k .")
      machine.succeed("kubectl wait pods -n client-mode-overlay -l app=hydrui --for=condition=Ready --timeout=120s")
      machine.succeed("cd ${../../deploy/kubernetes}/client-only-demo-overlay && kubectl delete -n client-mode-overlay -k .")

    with subtest("Client-only mode Helm deployment"):
      machine.succeed("KUBECONFIG=/etc/rancher/k3s/k3s.yaml helm install -n helm-client-mode --create-namespace helm-hydrui ${../../deploy/helm}/hydrui")
      machine.succeed("kubectl wait pods -n helm-client-mode -l app.kubernetes.io/name=hydrui --for=condition=Ready --timeout=120s")
      machine.succeed("KUBECONFIG=/etc/rancher/k3s/k3s.yaml helm uninstall -n helm-client-mode helm-hydrui")

    with subtest("Server mode deployment"):
      machine.succeed("kubectl create namespace server-mode")
      machine.succeed("cd ${../../deploy/kubernetes}/server-mode && kubectl apply -n server-mode -k .")
      machine.succeed("kubectl wait pods -n server-mode -l app=hydrui --for=condition=Ready --timeout=600s")
      machine.succeed("cd ${../../deploy/kubernetes}/server-mode && kubectl delete -n server-mode -k .")

    with subtest("Server mode deployment + demo overlay"):
      machine.succeed("kubectl create namespace server-mode-overlay")
      machine.succeed("cd ${../../deploy/kubernetes}/server-mode-demo-overlay && kubectl apply -n server-mode-overlay -k .")
      machine.succeed("kubectl wait pods -n server-mode-overlay -l app=hydrui --for=condition=Ready --timeout=600s")
      machine.succeed("cd ${../../deploy/kubernetes}/server-mode-demo-overlay && kubectl delete -n server-mode-overlay -k .")
  '';
}).overrideTestDerivation
  {
    outputHashAlgo = "sha256";
    outputHashMode = "recursive";
    outputHash = "sha256-pQpattmS9VmO3ZIQUFn66az8GSmB4IvYhTTCFn6SUmo=";
  }
