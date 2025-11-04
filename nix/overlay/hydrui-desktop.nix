{
  lib,
  stdenv,
  cmake,
  ninja,
  qt6,
  kdePackages,
}:
stdenv.mkDerivation {
  pname = "hydrui-desktop";
  version = builtins.readFile ../../VERSION;
  src = ./../..;

  postUnpack = ''
    sourceRoot=$sourceRoot/desktop
  '';

  nativeBuildInputs = [
    cmake
    ninja
    qt6.wrapQtAppsHook
  ];

  buildInputs = [
    qt6.qtbase
    kdePackages.qcoro
  ];

  cmakeFlags = [
    "-GNinja"
  ];

  meta = with lib; {
    description = "Desktop client for Hydrui";
    homepage = "https://github.com/hydrui/hydrui";
    license = licenses.isc;
    platforms = platforms.linux;
    mainProgram = "hydrui-desktop";
  };
}
