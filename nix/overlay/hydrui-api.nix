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

  vendorHash = "sha256-kPGwUat9pJrn+MkCiW3j8PyxXx0Rluz6+nxgOnaU+G4=";
}
