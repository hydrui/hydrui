# Compile from source

## Prerequisites

To compile from source, you need to install the following software:

- [Git](https://git-scm.com)
- [Go](https://go.dev)
- [Node](https://nodejs.org)

## Acquire source code

To acquire source code, clone it using Git. Open a terminal window and use the `git` command.

```console
$ git clone https://github.com/hydrui/hydrui.git
...
$ cd hydrui
```

## Install Node.JS dependencies

The Node.JS dependencies will be needed for compiling the frontend portion of the application.

```console
$ npm i
...
$
```

## Build frontend

You can now build the frontend portion of Hydrui.

```console
$ npm run pack
```

After a couple minutes, this should finish. Asset compression may take longer depending on your CPU.

## Build server

You can now build the server.

```console
$ go build -o hydrui-server ./cmd/hydrui-server
```

It is also possible to cross-compile the server. For example, here's how you can make a build for Windows:

```console
$ GOOS=windows GOARCH=amd64 go build -o hydrui-server.exe ./cmd/hydrui-server
```

On PowerShell (for example, under Windows), the syntax is a little different.

```console
PS> $Env:GOOS="linux"
PS> $Env:GOARCH="amd64"
PS> go build -o hydrui-server.bin ./cmd/hydrui-server
```

## Run server

You can now run the server. Check out the [Run locally](../run-locally) instructions for more information.
