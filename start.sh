#!/usr/bin/env bash
# Serve the suite locally and open it in the default browser (use a Chromium-based browser).
cd "$(dirname "$0")"
(sleep 1 && xdg-open http://localhost:5500 >/dev/null 2>&1) &
python3 -m http.server 5500
