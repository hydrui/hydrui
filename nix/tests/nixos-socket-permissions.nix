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
      port = null;
      user = "hydrui";
      group = "hydrui";
      socket = "/run/hydrui/hydrui.sock";
      socketPerms = "0664";
    };

    users.users.hydrui = {
      isSystemUser = true;
      group = "hydrui";
    };

    users.groups.hydrui = { };

    system.stateVersion = lib.trivial.release;
  };

  testScript = ''
    machine.wait_for_unit("multi-user.target")
    machine.wait_for_unit("hydrui-server.service")
    machine.wait_until_succeeds("test -S /run/hydrui/hydrui.sock")
    machine.succeed("test \"$(stat -c %a /run/hydrui/hydrui.sock)\" = 664")
    machine.succeed("test \"$(stat -c %U /run/hydrui/hydrui.sock)\" = hydrui")
    machine.succeed("test \"$(stat -c %G /run/hydrui/hydrui.sock)\" = hydrui")
  '';
}
