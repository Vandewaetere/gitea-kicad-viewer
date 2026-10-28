#!/bin/sh
# ==========================================================================================================================
# gitea-kicad-viewer — build
# ==========================================================================================================================
# Builds ecad-viewer (Huaqiu Electronics, MIT) at a fixed commit and puts everything Gitea needs in dist/:
#   dist/public/assets/kicad-viewer/   ecad-viewer.js, parser.worker.js, glyph-full.js, loader.js, loader.css, licenses
#   dist/kicad-viewer/render.sh        the render command Gitea calls
# The build runs in the official Node.js image, so nothing is installed on the host. Needs Docker and git.
# ==========================================================================================================================
set -e
export PATH=$PATH:/snap/bin

# The ecad-viewer version we build. Change both together when updating.
ECAD_REPO=https://github.com/Huaqiu-Electronics/ecad-viewer.git
ECAD_COMMIT=a2679a117f7074df761e8de45c393f63cdb9884a
NODE=node:24-bookworm-slim

DIR=$(cd "$(dirname "$0")" && pwd)
SRC=$DIR/dist/.src/ecad-viewer
OUT=$DIR/dist/public/assets/kicad-viewer

# Fetch the pinned commit (kept in dist/.src between builds).
if [ ! -d "$SRC/.git" ]; then mkdir -p "$SRC" && git -C "$SRC" init -q && git -C "$SRC" remote add origin "$ECAD_REPO"; fi
git -C "$SRC" fetch -q --depth 1 origin "$ECAD_COMMIT"
git -C "$SRC" checkout -q --force "$ECAD_COMMIT"

# Install and build: the parser, the renderer and the viewer app (+ the full glyph set for non-latin text).
docker run --rm -v "$SRC:/src" -w /src "$NODE" sh -c '
  set -e
  npm ci --no-audit --no-fund --loglevel=error
  npm run -s build -w @huaqiu/kicad-sexpr-parser
  npm run -s build -w @huaqiu/ecad-renderer
  cd packages/ecad-viewer-app && npm run -s build:no-check && npm run -s build:glyph
  chown -R '"$(id -u):$(id -g)"' /src'

# Collect the output.
rm -rf "$DIR/dist/public" "$DIR/dist/kicad-viewer"
mkdir -p "$OUT" "$DIR/dist/kicad-viewer"
for f in ecad-viewer.js parser.worker.js glyph-full.js; do cp "$SRC/packages/ecad-viewer-app/build/$f" "$OUT/"; done
cp "$DIR/src/loader.js" "$DIR/src/loader.css" "$OUT/"
cp "$DIR/src/render.sh" "$DIR/dist/kicad-viewer/"
cp "$SRC/LICENSE.md" "$OUT/LICENSE-ecad-viewer.md"
cp "$DIR/LICENSE" "$OUT/LICENSE-gitea-kicad-viewer"
echo "ecad-viewer $ECAD_COMMIT" > "$OUT/VERSION"
echo "built: $(du -sh "$OUT" | cut -f1) in dist/"
