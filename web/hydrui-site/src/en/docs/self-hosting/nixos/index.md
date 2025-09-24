# NixOS

**Note:** This documentation is written assuming you are using Nix flakes. Using Nix with channels is not currently supported, though it should be possible.

## Add flake input

Add the Hydrui flake to the Nix flake that contains your system configuration.

```nix
{
  inputs = {
    ...
    hydrui = {
      url = "github:hydrui/hydrui";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    ...
  };
  ...
}
```

## Add NixOS module

Where your NixOS system configuration is defined, add the NixOS module.

```nix
{
  outputs =
    {
      ...
      hydrui,
      ...
    }:
    {
      nixosConfiguration = {
        default = nixpkgs.lib.nixosSystem {
          ...
          modules = [
            ...
            hydrui.nixosModules.hydrui
            ...
          ];
        };
      };
    };
}
```

## Configure the NixOS module

Within your system configuration, you can now use the Hydrui options.

```
{ config, ... }: {
  services.hydrui = {
    enable = true;

    # Enables "server mode". Check the documentation for more information.
    # https://hydrui.dev/en/docs/server-mode/
    serverMode = true;

    # The rest of the options are only allowed when using server mode.

    # Hydrus URL to connect to.
    hydrusUrl = "http://localhost:45869";

    # You can also insecurely pass API credentials using builtins.toFile,
    # but this will be *world-readable* in your Nix store. Tread carefully.
    hydrusApiKeyFile = config.sops.secrets.hydrus-api-key.path;

    # Provide an htpasswd file with login credentials.
    # Compatible with Apache .htpasswd, but only bcrypt is supported.
    # A simple HTML utility for editing htpasswd files is available here:
    # https://hydrui.dev/tools/htpasswd/
    htpasswdFile = ./htpasswd.txt;

    # Disable sending issue reports.
    allowReport = false;
  };
}
```

Secret files will be passed in via systemd credentials, so you do not need to make them accessible to any user except for root.

### NixOS module options

{% for option in nixosModuleOptions %}

#### services.hydrui.{{ option.name }}

<table class="options-table">
  <tbody>
    <tr>
      <th>Description</th>
      <td>{{ option.description }}</td>
    </tr>
    <tr>
      <th>Type</th>
      <td>{{ option.type }}</td>
    </tr>
    {% if option.default %}
    <tr>
      <th>Default</th>
      <td>
        {%- if option.default._type == "literalExpression" -%}
          <code>{{ option.default.text }}</code>
        {%- elsif option.default == "" -%}
          <code>""</code>
        {%- else -%}
          {{ option.default }}
        {%- endif -%}
      </td>
    </tr>
    {% endif %}
    {% if option.example %}
    <tr>
      <th>Example</th>
      <td><code>{{ option.example }}</code></td>
    </tr>
    {% endif %}
  </tbody>
</table>
{% endfor %}
