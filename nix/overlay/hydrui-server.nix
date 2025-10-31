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

  vendorHash = "sha256-gwCUhW+8UDYpHu4oUPdY8x/cJB84X+V6Imvl+Rq6PO0=";
}
