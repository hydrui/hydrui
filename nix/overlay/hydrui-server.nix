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

  vendorHash = "sha256-kPGwUat9pJrn+MkCiW3j8PyxXx0Rluz6+nxgOnaU+G4=";
}
