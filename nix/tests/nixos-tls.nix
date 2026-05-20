{
  lib,
  pkgs,
  testers,
}:
let
  certs = pkgs.runCommand "test-certs" { buildInputs = [ pkgs.openssl ]; } ''
    mkdir -p $out
    openssl req -x509 -newkey rsa:2048 -keyout $out/key.pem -out $out/cert.pem -days 365 -nodes \
      -subj "/CN=localhost"
  '';
in
testers.nixosTest {
  name = "hydrui-nixos-module-tls";

  nodes.machine = {
    imports = [ ../module.nix ];

    services.hydrui = {
      enable = true;
      port = 7070;
      portTLS = 8443;
      tlsCertFile = "${certs}/cert.pem";
      tlsKeyFile = "${certs}/key.pem";
    };

    system.stateVersion = lib.trivial.release;
  };

  testScript = ''
    machine.wait_for_unit("multi-user.target")
    machine.wait_for_unit("hydrui-server.service")
    machine.wait_for_open_port(7070)
    machine.wait_for_open_port(8443)

    # Test HTTP -> HTTPS redirection
    response_redirect = machine.succeed("curl -s -o /dev/null -w '%{http_code} %{redirect_url}' http://localhost:7070/")
    assert response_redirect == "302 https://localhost:8443/", f"Expected redirect, got: {response_redirect}"

    # Test HTTPS directly using curl
    response_tls = machine.succeed("curl -k -s -o /dev/null -w '%{http_code}' https://localhost:8443/")
    assert response_tls == "200", f"Expected HTTP 200, got {response_tls}"
  '';
}
