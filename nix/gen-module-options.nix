{
  self,
  nixpkgs,
  writeShellApplication,
}:
let
  options =
    let
      system = nixpkgs.lib.nixosSystem {
        system = "x86_64-linux";
        modules = [
          ./module.nix
        ];
      };
      inherit (system) options pkgs;
      inherit (pkgs) lib;
    in
    lib.lists.sortOn (option: option.location.line) (
      lib.attrsets.mapAttrsToList (name: value: {
        inherit name;
        inherit (value) description;
        default = value.defaultText or value.default;
        example = value.example or null;
        type = value.type.description;
        location =
          let
            position = builtins.head value.declarationPositions;
          in
          {
            inherit (position) line column;
            file = lib.strings.removePrefix (self + "/") position.file;
          };
      }) (lib.attrsets.filterAttrs (name: value: value._type == "option") options.services.hydrui)
    );
in
writeShellApplication {
  name = "gen-module-options";
  text = ''
    < ${builtins.toFile "nixosModuleOptions.json" (builtins.toJSON options)} \
    npx prettier --stdin-filepath nixosModuleOptions.json \
    >./web/hydrui-site/src/_data/nixosModuleOptions.json
  '';
}
