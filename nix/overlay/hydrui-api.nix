{
  buildGoModule,
}:
buildGoModule {
  name = "hydrui-api";
  version = builtins.readFile ../../VERSION;
  src = ./../..;

  subPackages = [
    "cmd/hydrui-api"
    "cmd/gen-keys"
  ];

  vendorHash = "sha256-shs2vN7+d173pfXEmTYYVNTL1bLC/beR/HdmeIIijoI=";
}
