{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.services.hydrui;
  inherit (lib)
    types
    mkOption
    mkEnableOption
    mkIf
    optionals
    ;
  boolStr = b: if b == true then "true" else "false";
  args = [
    "-nogui=true"
    "-server-mode=${boolStr cfg.serverMode}"
    "-acme=${boolStr cfg.acme}"
  ]
  ++ optionals (cfg.port != null) [
    "-listen"
    "${toString cfg.bindAddress}:${toString cfg.port}"
  ]
  ++ optionals (cfg.socket != null) [
    "-socket"
    cfg.socket
  ]
  ++ optionals (cfg.hydrusUrl != null) [
    "-hydrus-url"
    cfg.hydrusUrl
  ]
  ++ optionals (cfg.hydrusApiKeyFile != null) [
    "-hydrus-api-key-file"
    "$CREDENTIALS_DIRECTORY/api-key"
  ]
  ++ optionals (cfg.htpasswdFile != null) [
    "-htpasswd"
    "$CREDENTIALS_DIRECTORY/htpasswd"
  ]
  ++ optionals (cfg.allowReport != null) [
    "-allow-bug-report=${boolStr cfg.allowReport}"
  ]
  # Hydrui Server will create the secret file if it doesn't exist.
  ++ optionals (cfg.serverMode && cfg.secretFile == null) [
    "-secret-file"
    "$STATE_DIRECTORY/secret"
  ]
  # If the user provides a secret file, we pass it in through credentials.
  ++ optionals (cfg.serverMode && cfg.secretFile != null) [
    "-secret-file"
    "$CREDENTIALS_DIRECTORY/secret"
  ];
in
{
  options = {
    services.hydrui = {
      enable = mkEnableOption "Hydrui Server";

      # Module options
      package = lib.mkPackageOption pkgs "hydrui-server" { };
      openFirewall = mkEnableOption "" // {
        description = "Whether to automatically open the necessary ports in the firewall.";
        default = true;
      };

      # Hydrui Server options
      serverMode = mkEnableOption "" // {
        description = ''
          Enable Hydrui's server mode, as opposed to the default client-only mode.

          When enabled, Hydrui Server will act as a proxy to the upstream hydrus client.
          The API credentials will need to be specified directly to Hydrui Server. When
          this value is set, hydrusUrl and hydrusApiKeyFile must be set.
        '';
      };
      acme = mkEnableOption "automatic TLS with ACME";
      bindAddress = mkOption {
        type = types.str;
        default = "";
        example = "127.0.0.1";
        description = "Address to listen on; empty string for all interfaces.";
      };
      port = mkOption {
        type = types.nullOr types.port;
        default = 8080;
        description = "Port to listen on, or null to disable listening on TCP.";
      };
      socket = mkOption {
        type = types.nullOr types.path;
        default = null;
        example = "/var/run/hydrui.sock";
        description = "UNIX domain socket path to bind, or null to disable listening on a UNIX domain socket.";
      };
      hydrusUrl = mkOption {
        type = types.nullOr types.str;
        default = null;
        example = "http://localhost:45869";
        description = "Hydrus client API server to connect to. (server mode only)";
      };
      hydrusApiKeyFile = mkOption {
        type = types.nullOr types.path;
        default = null;
        description = "Path to a file that contains the hydrus client API access key. (server mode only)";
      };
      htpasswdFile = mkOption {
        type = types.nullOr types.path;
        default = null;
        description = "Path to a file that contains an htpasswd file for authentication. (server mode only)";
      };
      allowReport = mkOption {
        type = types.nullOr types.bool;
        default = if cfg.serverMode then true else null;
        description = ''
          Allow users to submit issue reports to the Hydrui Mothership. You can
          disable this to improve privacy if you don't think you will ever use
          the issue reporting functionality within Hydrui. (server mode only)
        '';
      };
      secretFile = mkOption {
        type = types.nullOr types.path;
        default = null;
        description = "Secret keymatter used for session validation. If not specified, it will be generated and stored locally in /var/lib.";
      };
    };
  };
  config = mkIf cfg.enable {
    assertions = [
      {
        assertion = (cfg.port == null) != (cfg.socket == null);
        message = "one and only one of services.hydrui.port and services.hydrui.socket may be set";
      }
      {
        assertion = cfg.serverMode == true || cfg.hydrusUrl == null;
        message = "services.hydrui.hydrusUrl can't be set in client-only mode; see services.hydrui.serverMode";
      }
      {
        assertion = cfg.serverMode == true || cfg.hydrusApiKeyFile == null;
        message = "services.hydrui.hydrusApiKeyFile can't be set in client-only mode; see services.hydrui.serverMode";
      }
      {
        assertion = cfg.serverMode == true || cfg.htpasswdFile == null;
        message = "services.hydrui.htpasswd can't be set in client-only mode; see services.hydrui.serverMode";
      }
      {
        assertion = cfg.serverMode == true || cfg.allowReport == null;
        message = "services.hydrui.allowReport can't be set in client-only mode; see services.hydrui.serverMode";
      }
      {
        assertion = cfg.serverMode == true || cfg.secretFile == null;
        message = "services.hydrui.secretFile can't be set in client-only; see services.hydrui.serverMode";
      }
      {
        assertion = cfg.serverMode == false || cfg.hydrusUrl != null;
        message = "services.hydrui.hydrusUrl must be set in server mode; see services.hydrui.serverMode";
      }
      {
        assertion = cfg.serverMode == false || cfg.hydrusApiKeyFile != null;
        message = "services.hydrui.hydrusApiKeyFile must be set in server mode; see services.hydrui.serverMode";
      }
    ];
    warnings =
      if cfg.serverMode == true && cfg.htpasswdFile == null then
        [
          ''
            You have enabled server mode, but not provided an htpasswd file.
            This will result in the insecure default credentials of admin:admin being used.
          ''
        ]
      else
        [ ];
    nixpkgs.overlays = [ (import ./overlay) ];
    environment.systemPackages = [ cfg.package ];
    systemd.services.hydrui-server = {
      description = "Hydrui Server";
      documentation = [ "https://hydrui.dev" ];
      wantedBy = [ "multi-user.target" ];
      wants = [ "network-online.target" ];
      after = [
        "network-online.target"
      ];
      serviceConfig = {
        DynamicUser = true;
        ExecStart = "${cfg.package}/bin/hydrui-server ${lib.concatStringsSep " " args}";
        LoadCredential =
          optionals cfg.serverMode [
            "secret:${cfg.secretFile}"
          ]
          ++ optionals (cfg.hydrusApiKeyFile != null) [
            "hydrus-api-key:${cfg.hydrusApiKeyFile}"
          ]
          ++ optionals (cfg.htpasswdFile != null) [
            "htpasswd:${cfg.htpasswdFile}"
          ];
        LockPersonality = true;
        MemoryDenyWriteExecute = true;
        ProtectClock = true;
        ProtectControlGroups = true;
        ProtectHostname = true;
        ProtectKernelLogs = true;
        ProtectKernelModules = true;
        ProtectKernelTunables = true;
        PrivateDevices = true;
        PrivateMounts = true;
        PrivateUsers = true;
        RestrictNamespaces = true;
        RestrictRealtime = true;
        Restart = "on-failure";
        RestartSec = 10;
        SystemCallArchitectures = "native";
        SystemCallFilter = [
          "@system-service"
          "~@privileged"
        ];
        StateDirectory = "hydrui-server";
        StateDirectoryMode = "0700";
        User = "hydrui";
        UMask = "077";
      };
      unitConfig = {
        StartLimitBurst = 5;
      };
    };
    networking.firewall = mkIf (cfg.openFirewall && cfg.port != null) {
      allowedTCPPorts = [ cfg.port ];
    };
  };
}
