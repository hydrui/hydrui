{
  lib,
  testers,
}:
testers.nixosTest {
  name = "hydrui-nixos-module";

  nodes.machine = {
    imports = [ ../module.nix ];

    services.hydrui = {
      enable = true;
      port = 7070;
    };

    system.stateVersion = lib.trivial.release;
  };

  testScript = ''
    machine.wait_for_unit("multi-user.target")
    machine.wait_for_unit("hydrui-server.service")
    machine.wait_for_open_port(7070)
    response = machine.succeed("curl -s -o /dev/null -w '%{http_code}' http://localhost:7070")
    assert response == "200", f"Expected HTTP 200, got {response}"
  '';
}
