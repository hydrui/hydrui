{
  buildGoModule,
  hydrui-www,
}:
buildGoModule {
  name = "hydrui-server";
  version = builtins.readFile ../../VERSION;
  src = ./../..;

  subPackages = [
    "cmd/hydrui-server"
  ];

  preBuild = ''
    cp ${hydrui-www}/share/hydrui/internal/webdata/*.pack ./internal/webdata
  '';

  vendorHash = "sha256-shs2vN7+d173pfXEmTYYVNTL1bLC/beR/HdmeIIijoI=";
}
