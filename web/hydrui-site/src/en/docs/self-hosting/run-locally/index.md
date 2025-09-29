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
