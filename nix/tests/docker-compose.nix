{
  docker-compose,
  testers,
}:
(testers.invalidateFetcherByDrvHash testers.nixosTest {
  name = "hydrui-docker-compose";
  nodes.machine = {
    virtualisation.docker.enable = true;
    environment.systemPackages = [ docker-compose ];
    virtualisation.diskSize = 5 * 1024;
    virtualisation.memorySize = 4 * 1024;
  };
  testScript = ''
    machine.wait_for_unit("multi-user.target")

    with subtest("Docker container builds"):
      machine.succeed("docker build -t ghcr.io/hydrui/hydrui:edge ${../..}")

    with subtest("Client-only mode compose"):
      machine.succeed("cd ${../../deploy/compose/client-only} && docker compose up -d")
      machine.wait_for_open_port(8080)
      container_name = machine.succeed("docker ps -a --format {{.Names}} | grep client-only-hydrui-1 | tr -d '\n'")
      machine.wait_until_succeeds('test "$(docker inspect --format={{.State.Health.Status}} ' + container_name + ')" = "healthy"')
      machine.succeed("cd ${../../deploy/compose/client-only} && docker compose down")

    with subtest("Server mode compose"):
      machine.succeed("cd ${../../deploy/compose/server-mode} && docker compose up -d")
      machine.wait_for_open_port(8080)
      container_name = machine.succeed("docker ps -a --format {{.Names}} | grep server-mode-hydrui-1 | tr -d '\n'")
      machine.wait_until_succeeds('test "$(docker inspect --format={{.State.Health.Status}} ' + container_name + ')" = "healthy"')
      machine.succeed("cd ${../../deploy/compose/server-mode} && docker compose down")
  '';
}).overrideTestDerivation
  {
    outputHashAlgo = "sha256";
    outputHashMode = "recursive";
    outputHash = "sha256-pQpattmS9VmO3ZIQUFn66az8GSmB4IvYhTTCFn6SUmo=";
  }
