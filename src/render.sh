#!/bin/sh
# gitea-kicad-viewer — render command for Gitea's external renderer ([markup.kicad] in app.ini).
#
# Gitea runs this for every .kicad_sch / .kicad_pcb / .kicad_pro file it shows, with the file on stdin, and puts the
# result in a sandboxed iframe. We print a small page that loads the viewer from Gitea's own /assets/ (no CDN, no
# external requests). The file itself is passed along inline (base64); with allow-same-origin in the sandbox the loader
# reads the whole project instead (see README).
#
# GITEA_PREFIX_SRC / GITEA_PREFIX_RAW: set by Gitea, e.g. /owner/repo/src/branch/main and /owner/repo/raw/branch/main.
# KICAD_VIEWER_ASSETS: where the assets are served; default /assets/kicad-viewer (set it if Gitea runs under a sub-path).
A=${KICAD_VIEWER_ASSETS:-/assets/kicad-viewer}
# Version of the build (written by build.sh next to this script). It goes into the asset URLs, so browsers fetch the
# new files after an update instead of using their cached copy (Gitea lets them cache /assets/ for hours).
V=$(cat "$(dirname "$0")/VERSION" 2>/dev/null || echo 0)

printf '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="%s/loader.css?v=%s"></head><body>\n' "$A" "$V"
printf '<script id="kv-config" type="application/json">{"src":"%s","raw":"%s"}</script>\n' "$GITEA_PREFIX_SRC" "$GITEA_PREFIX_RAW"
printf '<script id="kv-inline" type="text/plain">'
base64 | tr -d '\n'
printf '</script>\n<script src="%s/loader.js?v=%s"></script>\n</body></html>\n' "$A" "$V"
