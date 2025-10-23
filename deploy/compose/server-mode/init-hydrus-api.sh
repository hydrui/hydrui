#!/bin/sh
set -eu
if [ ! -f "/opt/hydrus/db/.initialized" ]; then
  # Run hydrus to initialize the database directory.
  if [ ! -f "/opt/hydrus/db/client.db" ]; then
    echo "Initializing hydrus client database."
    INIT_LOG=$(mktemp)
    su hydrus -s /bin/sh -c "/usr/bin/env QT_QPA_PLATFORM=offscreen python3 /opt/hydrus/hydrus_client.py -d /opt/hydrus/db/" >"$INIT_LOG" 2>&1 &
    HYDRUS_PID=$!
    ELAPSED=0
    while [ $ELAPSED -lt 120 ]; do
      if grep -q "To dismiss popup messages" "$INIT_LOG" 2>/dev/null; then
        echo "Hydrus initialization complete, shutting down..."
        break
      fi
      sleep 1
      ELAPSED=$((ELAPSED + 1))
    done
    kill -INT $HYDRUS_PID 2>/dev/null || true
    wait $HYDRUS_PID 2>/dev/null || true
    rm -f "$INIT_LOG"
  fi

  # Enable the API and set up an access key by directly modifying the database.
  JSON='[21, 2, ['
  JSON="$JSON"'[[0, "port"], [0, 45869]], '
  JSON="$JSON"'[[0, "upnp_port"], [0, null]], '
  JSON="$JSON"'[[0, "allow_non_local_connections"], [0, true]], '
  JSON="$JSON"'[[0, "support_cors"], [0, true]], '
  JSON="$JSON"'[[0, "log_requests"], [0, false]], '
  JSON="$JSON"'[[0, "use_normie_eris"], [0, true]], '
  JSON="$JSON"'[[0, "bandwidth_tracker"], [2, [39, 1, [[], [], [], [], [], [], [], [], [], []]]]], '
  JSON="$JSON"'[[0, "bandwidth_rules"], [2, [38, 1, []]]], '
  JSON="$JSON"'[[0, "external_scheme_override"], [0, null]], '
  JSON="$JSON"'[[0, "external_host_override"], [0, null]], '
  JSON="$JSON"'[[0, "external_port_override"], [0, null]], '
  JSON="$JSON"'[[0, "use_https"], [0, false]]]]'
  SERVICE_CONFIG_HEX=$(printf '%s' "$JSON" | xxd -p | tr -d '\n')
  JSON="[[76, \"new api permissions\", 2, [\"$HYDRUI_HYDRUS_API_KEY\", true, [], [44, 1, []]]]]"
  API_KEY_CONFIG_HEX=$(printf '%s' "$JSON" | xxd -p | tr -d '\n')

  apk add --no-cache sqlite
  sqlite3 /opt/hydrus/db/client.db \
    "UPDATE services SET dictionary_string = X'$SERVICE_CONFIG_HEX' WHERE service_type = 18;"
  sqlite3 /opt/hydrus/db/client.db \
    "UPDATE json_dumps SET dump = X'$API_KEY_CONFIG_HEX' WHERE dump_type = 75;"

  # And then finally, place a sentinel so we know not to do this initialization
  # more than once.
  touch /opt/hydrus/db/.initialized
  echo "Done, bootstrapping to main entrypoint."
fi
exec /bin/sh /opt/hydrus/static/build_files/docker/client/entrypoint.sh
