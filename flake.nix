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
        inherit (pkgs) hydrui-server hydrui-api hydrui-desktop;
        format = pkgs.callPackage ./nix/format.nix { };
        gen-module-options = pkgs.callPackage ./nix/gen-module-options.nix { inherit self nixpkgs; };
        tests-docker-compose = pkgs.callPackage ./nix/tests/docker-compose.nix { };
        tests-kubernetes = pkgs.callPackage ./nix/tests/kubernetes.nix { };
      in
      {
        packages = {
          inherit
            hydrui-server
            hydrui-api
            hydrui-desktop
            format
            gen-module-options
            tests-docker-compose
            tests-kubernetes
            ;
          default = hydrui-server;
        };
        checks = {
          format = pkgs.runCommandLocal "check-format" { } ''
            cd ${self} && ${pkgs.lib.getExe format} --check && touch $out
          '';
          helm-lint = pkgs.runCommandLocal "check-helm-lint" { buildInputs = [ pkgs.kubernetes-helm ]; } ''
            helm lint ${self}/deploy/helm/hydrui && touch $out
          '';
          inherit
            hydrui-server
            hydrui-api
            tests-docker-compose
            tests-kubernetes
            ;
        };
        devShells = {
          default = pkgs.mkShell {
            buildInputs = with pkgs; [
              nodejs_22
              go
            ];
          };
          desktop = pkgs.mkShell {
            buildInputs = [
              pkgs.clang-tools
            ];
            inputsFrom = [ hydrui-desktop ];
          };
        };
      }
    )
    // {
      nixosModules.hydrui = module;
    };
}
