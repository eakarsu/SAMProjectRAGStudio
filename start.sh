#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
cd "$script_dir"

network_ip="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
if [ -n "$network_ip" ]; then
  echo "ProcureScope will be available at http://${network_ip}:3000"
else
  echo "ProcureScope will listen on every network interface at port 3000"
fi

npm run dev -- --hostname 0.0.0.0
