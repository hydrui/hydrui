final: prev: {
  hydrui-api = final.callPackage ./hydrui-api.nix { };
  hydrui-server = final.callPackage ./hydrui-server.nix { };
  hydrui-www = final.callPackage ./hydrui-www.nix { };
  hydrui-desktop = final.callPackage ./hydrui-desktop.nix { };
}
