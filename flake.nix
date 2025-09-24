{
  description = "Hydrui, a remote web UI for the hydrus client";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      ...
    }:
    let
      overlay = import ./nix/overlay;
      module = import ./nix/module.nix;
    in
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = (import nixpkgs) {
          inherit system;
          overlays = [ overlay ];
        };
        inherit (pkgs) hydrui-server hydrui-api;
        format = pkgs.callPackage ./nix/format.nix { };
        gen-module-options = pkgs.callPackage ./nix/gen-module-options.nix { inherit self nixpkgs; };
      in
      {
        packages = {
          inherit
            hydrui-server
            hydrui-api
            format
            gen-module-options
            ;
          default = hydrui-server;
        };
        checks = {
          format = pkgs.runCommandLocal "check-format" { } ''
            cd ${self} && ${pkgs.lib.getExe format} --check && touch $out
          '';
          inherit hydrui-server hydrui-api;
        };
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_22
            go
          ];
        };
      }
    )
    // {
      nixosModules.hydrui = module;
    };
}
