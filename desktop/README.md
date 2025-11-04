# Hydrui Desktop

A remote client for hydrus network, for the desktop.

## Building

Hydrui Desktop is built with CMake. You can use Nix to build:

```bash
$ nix build .#hydrui-desktop
...
# The binary will be available at `result/bin/hydrui-desktop`.
```

You can use Nix to get a development shell:

```bash
$ nix develop .#desktop
```

If you are not using Nix, you'll need to have a working C++ compiler, development files for Qt 6 core and Qt 6 widgets available, CMake, and GNU Make or optionally Ninja Build available in your environment. Here are some examples of how you might do this on different Linux distributions:

```bash
# Ubuntu / Debian
$ sudo apt install build-essential cmake qt6-base-dev libqt6core6 libqt6widgets6

# Fedora
$ sudo dnf install gcc-c++ cmake qt6-qtbase-devel

# Arch Linux
$ sudo pacman -S base-devel cmake qt6-base
```

Once you have a suitable environment, whether via `nix develop` or by installing packages into your local environment, you can build with CMake as follows:

```bash
$ cd desktop
$ cmake -B .build -S .
...
$ cmake --build .build
...
```
