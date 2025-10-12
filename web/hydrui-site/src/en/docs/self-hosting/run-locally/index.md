# Run locally

Running Hydrui locally is fairly straight-forward. The first thing you need to do is download the appropriate executable binary files for your platform. Then, you can simply run the executable file. This will give you a basic Hydrui server in client-only mode (same as the hosted service).

## Download the appropriate binary

Each platform supported by Hydrui has a corresponding set of binaries.

<p>
<script>
;;(function() {
  const prefix = "The machine you are browsing this page from seems to be ";
  if (window.navigator.userAgent.match(/PlayStation/i)) {
    document.write(prefix + "a PlayStation?");
  } else if (window.navigator.platform.match(/iPhone/i)) {
    document.write(prefix + "an iPhone.");
  } else if (window.navigator.platform.match(/iPad/i)) {
    document.write(prefix + "an iPad.");
  } else if (window.navigator.platform.match(/Android/i) || window.navigator.userAgent.match(/Android/i)) {
    if (window.navigator.platform.match(/x86_64/i)) {
      document.write(prefix + "using Android on the AMD64 architecture.");
    } else if (window.navigator.platform.match(/aarch64/i)) {
      document.write(prefix + "using Android on the ARM64 architecture.");
    } else if (window.navigator.platform.match(/armv/i)) {
      document.write(prefix + "using Android on the ARM architecture.");
    } else {
      document.write(prefix + "an Android device.");
    }
  } else if (window.navigator.platform.match(/Linux/i)) {
    if (window.navigator.platform.match(/x86_64/i)) {
      document.write(prefix + "using Linux on the AMD64 architecture.");
    } else if (window.navigator.platform.match(/i686/i)) {
      document.write(prefix + "using Linux on the 386 architecture.");
    } else if (window.navigator.platform.match(/aarch64/i)) {
      document.write(prefix + "using Linux on the ARM64 architecture.");
    } else if (window.navigator.platform.match(/armv/i)) {
      document.write(prefix + "using Linux on the ARM architecture.");
    } else if (window.navigator.platform.match(/ppc64/i)) {
      document.write(prefix + "using Linux on the PPC64 architecture. Very cool.");
    } else if (window.navigator.platform.match(/mips/i)) {
      document.write(prefix + "using Linux on the MIPS architecture. Really?");
    } else {
      document.write(prefix + "using Linux, but I can't determine the CPU architecture.");
    }
  } else if (window.navigator.platform.match(/FreeBSD/i)) {
    if (window.navigator.platform.match(/x86_64/i)) {
      document.write(prefix + "using FreeBSD on the AMD64 architecture.");
    } else if (window.navigator.platform.match(/i686/i)) {
      document.write(prefix + "using FreeBSD on the 386 architecture.");
    } else {
      document.write(prefix + "using FreeBSD, but I can't determine the CPU architecture.");
    }
  } else if (window.navigator.platform.match(/Macintosh|MacIntel/i)) {
    document.write(prefix + "using macOS.");
  } else if (window.navigator.platform.match(/MacPPC/i)) {
    document.write(prefix + "using macOS on PowerPC");
  } else if (window.navigator.platform.match(/Mac68K/i)) {
    document.write(prefix + "using MacOS on a Motorola 68000 series. Would be very cool, but you're probably lying.");
  } else if (window.navigator.platform.match(/Win16/i)) {
    document.write(prefix + "using 16-bit Windows. Really?");
  } else if (window.navigator.platform.match(/Win32/i)) {
    document.write(prefix + "using Windows.");
  } else {
    document.write("I can't tell what type of machine you are browsing this page from.")
  }
})();
</script>
<noscript>
  You have JavaScript disabled, so I can't tell what type of machine you are browsing this page from.
</noscript>
</p>

Go to the latest release, and you will see binaries for each supported system.

<a href="https://github.com/hydrui/hydrui/releases/latest/" class="button button-primary">Latest Release</a>

If your system is not listed, it may still be possible to [compile from source](../compile-from-source/).

## Run binary

### Windows

Under Windows, you can just double click the application. A rudimentary user interface is provided, and you should see an icon appear in your system tray. If you want Hydrui to run at startup, you could put it in your Startup folder.

Click the icon to open up Hydrui configuration. By default, Hydrui Server operates in client-only mode, since server mode requires some configuration; you can do that configuration in the UI.

Note that the UI currently does not have a way to edit the default log-in username/password. For now, you can generate an htpasswd file using the [online htpasswd editor](/tools/htpasswd/).

### Other platforms

Under Linux, macOS, FreeBSD and other platforms, the primary interface is the CLI for now.

After extracting the program, mark it executable.

```console
$ unzip hydrui-linux-amd64.zip
$ chmod +x ./hydrui-linux-amd64
```

Run the program from a terminal. For example:

```console
$ ./hydrui-linux-amd64
```

This will run Hydrui in client-only mode. To run in server mode, you need to supply the relevant flags:

```console
$ ./hydrui-linux-amd64 -server-mode -hydrus-api-key=xxx -hydrus-url=http://localhost:45869
```

Note that this will default to an insecure setup where the username and password is `admin`. You can supply an htpasswd file with the `-htpasswd` flag. For more information on what flags you can use, try passing `-help`.

It is also possible to run the Windows version of Hydrui Server under Wine, if you wish. Win32 is the true universal ABI, after all. Just note that the UI is a bit uglier than it even normally is when running under Wine.

## htpasswd setup

When running in server mode, you can use the [online htpasswd editor](/tools/htpasswd/) to make an htpasswd file, or you can use the `htpasswd` tool from the Apache httpd server package. Please note that Hydrui Server currently only supports Bcrypt password hashes in htpasswd files. You could create a new htpasswd file using the Apache httpd `htpasswd` tool like this:

```console
$ htpasswd -B -c htpasswd.txt test
Enter password:
Re-type new password:
Adding password for user test
$
```

This will create a new `htpasswd.txt` file with one user, `test`, with the password you enter at the prompt.

## Health checking

By default, the Hydrui server does not expose a health checking endpoint, but the `-listen-internal` or `-socket-internal` option will expose a plaintext HTTP server over TCP or UNIX domain sockets respectively that includes a health checking endpoint at `/healthz`. The health check endpoint is intended to be used with platforms like Docker and Kubernetes, allowing them to determine if the server is functioning properly. It returns the HTTP code 200 and the text "OK" when it succeeds, otherwise it will return a 5xx error with a single-line string error. For example:

```console
$ ./hydrui-linux-amd64 -listen :8080 -listen-internal :5050 &
$ curl http://localhost:8080/healthz
404 page not found
$ curl http://localhost:5050/healthz
OK
```

When using server mode, it is possible to query for the hydrus client status by appending `?check_hydrus` to the URL. This will verify that the hydrus client API is accessible and that the API key is valid. Since this round-trips the hydrus client API, you may want to have a more lax timeout and longer interval for this check.

```console
$ curl http://localhost:5050/healthz\?check_hydrus
Hydrus API returned failure: Did not find an entry for that access key!
```

## Options reference

| CLI Flag               | Env Var                   | Default   | Usage                                                                                                                                                                  |
| ---------------------- | ------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `-listen`              | `HYDRUI_LISTEN`           | `":8080"` | Listen address for HTTP (default ":8080")                                                                                                                              |
| `-listen-tls`          | `HYDRUI_LISTEN_TLS`       | &mdash;   | Listen address for HTTPS (TLS)                                                                                                                                         |
| `-listen-internal`     | `HYDRUI_LISTEN_INTERNAL`  | &mdash;   | Internal listen address (metrics/healthcheck/etc.)                                                                                                                     |
| `-socket`              | `HYDRUI_SOCKET`           | &mdash;   | Listen on UNIX domain socket for HTTP                                                                                                                                  |
| `-socket-tls`          | `HYDRUI_SOCKET_TLS`       | &mdash;   | Listen on UNIX domain socket for HTTPS (TLS)                                                                                                                           |
| `-socket-internal`     | `HYDRUI_SOCKET_INTERNAL`  | &mdash;   | Internal UNIX domain socket (metrics/healthcheck/etc.)                                                                                                                 |
| `-tls-cert-file`       | `HYDRUI_TLS_CERT_FILE`    | &mdash;   | TLS certificate file to use for TLS port (full chain, PEM-formatted)                                                                                                   |
| `-tls-key-file`        | `HYDRUI_TLS_KEY_FILE`     | &mdash;   | TLS private key file to use for TLS port (PEM-formatted)                                                                                                               |
| `-secret`              | `HYDRUI_SECRET`           | &mdash;   | String containing secret key for JWT token                                                                                                                             |
| `-secret-file`         | &mdash;                   | &mdash;   | Path to file containing secret key for JWT token                                                                                                                       |
| `-hydrus-url`          | `HYDRUI_HYDRUS_URL`       | &mdash;   | Hydrus URL                                                                                                                                                             |
| `-secure`              | `HYDRUI_HYDRUS_SECURE`    | `true`    | Use secure cookies                                                                                                                                                     |
| `-hydrus-api-key`      | `HYDRUI_HYDRUS_API_KEY`   | &mdash;   | String containing Hydrus API key                                                                                                                                       |
| `-hydrus-api-key-file` | &mdash;                   | &mdash;   | Path to file containing Hydrus API key                                                                                                                                 |
| `-htpasswd`            | `HYDRUI_HTPASSWD`         | &mdash;   | Path to htpasswd file for authentication                                                                                                                               |
| `-acme`                | `HYDRUI_ACME`             | &mdash;   | Enable ACME, acquire TLS certificate. A certificate will be acquired using an HTTP-01 challenge. Requires a publicly-accessible domain connected to the Hydrui server. |
| `-acme-email`          | `HYDRUI_ACME_EMAIL`       | &mdash;   | E-mail address to use for ACME account.                                                                                                                                |
| `-acme-url`            | `HYDRUI_ACME_URL`         | &mdash;   | URL to use for ACME endpoint (default "https://acme-v02.api.letsencrypt.org/directory")                                                                                |
| `-acme-dir`            | `HYDRUI_ACME_DIR`         | &mdash;   | Directory to store ACME credentials.                                                                                                                                   |
| `-acme-host-match`     | `HYDRUI_ACME_HOST_MATCH`  | &mdash;   | RE2-compatible regular expression pattern to match allowed hosts for ACME certs.                                                                                       |
| `-hydrus-secure`       | `HYDRUI_SECURE`           | &mdash;   | Enable validating the TLS certificate of the Hydrus server                                                                                                             |
| `-server-mode`         | `HYDRUI_SERVER_MODE`      | &mdash;   | Enable or disable server mode; server mode proxies the Hydrus API and provides a login page                                                                            |
| `-allow-bug-report`    | `HYDRUI_ALLOW_BUG_REPORT` | &mdash;   | Allow user to submit bug reports to the Hydrui Mothership (default true)                                                                                               |
| `-nogui`               | `HYDRUI_NOGUI`            | &mdash;   | Disable the GUI, if GUI support is available                                                                                                                           |
