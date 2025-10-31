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

  vendorHash = "sha256-gwCUhW+8UDYpHu4oUPdY8x/cJB84X+V6Imvl+Rq6PO0=";
}
