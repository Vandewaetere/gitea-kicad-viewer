#!/bin/sh
# ==========================================================================================================================
# gitea-kicad-viewer — end-to-end test
# ==========================================================================================================================
#
# WHAT IT TESTS
#   That KiCad files really show up as an interactive viewer in a real Gitea, seen through a real browser:
#     - with Gitea's default sandbox: a single schematic (.kicad_sch) from a private repository;
#     - with allow-same-origin: the whole project (.kicad_pro), with schematic and PCB;
#     - side by side with gitea-board-badges (its footer.tmpl is installed too): badges still show up;
#     - the viewer makes no requests outside Gitea.
#
# HOW
#   1. build.sh must have run (dist/). Test projects: the "video" demo that ships with ecad-viewer (dist/.src, 9 sheets)
#      and examples/rp2350-minimal (Raspberry Pi's RP2350A Minimal Design, KiCad 10, in a sub-folder).
#   2. Start a throwaway Gitea (official image gitea/gitea, GITEA_IMAGE overrides) on its own Docker network, with the
#      viewer installed as described in the README, and push the test project to a private repository.
#   3. Open the files in Chromium (Microsoft's official Playwright image) and check the result (test/browser.mjs).
#      This runs twice: once with Gitea's default sandbox, once with allow-same-origin.
#   4. Remove everything again, also when the test fails halfway.
#
# USAGE
#   ./build.sh && test/test.sh
#   GITEA_IMAGE=gitea/gitea:<version> test/test.sh   test with another Gitea version
#   BADGES=/path/to/footer.tmpl test/test.sh          gitea-board-badges to install next to it (default: latest release)
#   Exit code 0 = all checks passed. Screenshots go to test/out/.
# ==========================================================================================================================
set -e
export PATH=$PATH:/snap/bin

DIR=$(cd "$(dirname "$0")/.." && pwd)
IMAGE=${GITEA_IMAGE:-gitea/gitea:latest}
PW=mcr.microsoft.com/playwright:v1.56.0-noble
WORK=$DIR/test/.work
NAME=gkv_gitea_$$ NET=gkv_net_$$

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; docker network rm "$NET" >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

[ -f "$DIR/dist/public/assets/kicad-viewer/ecad-viewer.js" ] || { echo "run ./build.sh first"; exit 1; }
rm -rf "$WORK" && mkdir -p "$WORK/project" "$WORK/pw" "$DIR/test/out"

# The test project: ecad-viewer's own demo, unpacked from the pinned source.
python3 -c 'import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])' \
  "$DIR/dist/.src/ecad-viewer/packages/ecad-viewer-app/static/video.zip" "$WORK/project"
# Plus our own example project (examples/), in a sub-folder like in a real repository.
mkdir -p "$WORK/project/examples" && cp -r "$DIR/examples/rp2350-minimal" "$WORK/project/examples/"

# gitea-board-badges next to it.
if [ -n "$BADGES" ]; then cp "$BADGES" "$WORK/footer.tmpl"; else
  docker run --rm -v "$WORK:/w" "$PW" curl -fsSL -o /w/footer.tmpl \
    https://github.com/Vandewaetere/gitea-board-badges/releases/latest/download/footer.tmpl; fi

# Playwright library once (same version as the image); the browser runs later without network access to the outside.
cp "$DIR/test/browser.mjs" "$WORK/pw/"
docker run --rm -v "$WORK/pw:/pw" -w /pw "$PW" sh -c 'npm i -s --no-audit --no-fund playwright@1.56.0 >/dev/null 2>&1'
docker network create --internal "$NET" >/dev/null

run() {  # $1 = label, $2 = RENDER_CONTENT_SANDBOX value ("" = Gitea's default)
  rm -rf "$WORK/data" && mkdir -p "$WORK/data/gitea/templates/custom" "$WORK/data/gitea/public/assets"
  cp -r "$DIR/dist/public/assets/kicad-viewer" "$WORK/data/gitea/public/assets/"
  cp -r "$DIR/dist/kicad-viewer" "$WORK/data/"
  cp "$WORK/footer.tmpl" "$WORK/data/gitea/templates/custom/footer.tmpl"
  chown -R 1000:1000 "$WORK/data"
  M=markup_0X2E_kicad
  docker run -d --name "$NAME" --network "$NET" -e USER_UID=1000 -e USER_GID=1000 \
    -e GITEA__security__INSTALL_LOCK=true -e GITEA__database__DB_TYPE=sqlite3 -e GITEA__server__DISABLE_SSH=true \
    -e GITEA__server__ROOT_URL="http://$NAME:3000/" \
    -e GITEA__${M}__ENABLED=true -e GITEA__${M}__FILE_EXTENSIONS=.kicad_sch,.kicad_pcb,.kicad_pro \
    -e GITEA__${M}__RENDER_COMMAND="sh /data/kicad-viewer/render.sh" -e GITEA__${M}__RENDER_CONTENT_MODE=iframe \
    ${2:+-e GITEA__${M}__RENDER_CONTENT_SANDBOX="$2"} \
    -v "$WORK/data:/data" -v "$WORK/project:/project:ro" "$IMAGE" >/dev/null
  for i in $(seq 60); do docker exec "$NAME" curl -fsS http://127.0.0.1:3000/api/healthz >/dev/null 2>&1 && break; sleep 2; done
  [ "$1" = default ] && echo "gitea $(docker exec -u git "$NAME" gitea --version | cut -d' ' -f3)"

  docker exec -u git "$NAME" gitea admin user create --username tester --password 'Test-12345!' --email t@example.invalid \
    --admin --must-change-password=false >/dev/null
  T=$(docker exec -u git "$NAME" gitea admin user generate-access-token --username tester --token-name t --scopes all --raw)
  # A private repository with the project, one issue, and a board with that issue in "To Do" (for the badges check).
  docker exec -i -u git -e T="$T" "$NAME" sh -s <<'IN'
set -e
A=http://127.0.0.1:3000/api/v1/repos/tester/demo
j() { curl -fsS -o /dev/null -H "Authorization: token $T" -H 'Content-Type: application/json' "$@"; }
j -X POST http://127.0.0.1:3000/api/v1/user/repos -d '{"name":"demo","private":true}'
cp -r /project /tmp/p && cd /tmp/p && git init -q -b main && git add -A
git -c user.name=t -c user.email=t@example.invalid commit -qm demo
git push -q "http://tester:$T@127.0.0.1:3000/tester/demo.git" main
j -X POST $A/issues -d '{"title":"Check the schematic"}'
j -X POST $A/projects -d '{"title":"demo","template_type":"basic_kanban"}'
j -X POST $A/projects/1/columns/2/issues/1
IN

  docker run --rm --network "$NET" -e BASE="http://$NAME:3000" -e MODE="$1" -e DEBUG="$DEBUG" -v "$WORK/pw:/pw:ro" -v "$DIR/test/out:/out" \
    -w /pw "$PW" node browser.mjs
  docker rm -f "$NAME" >/dev/null
}

run default ""
run same-origin "allow-scripts allow-same-origin allow-popups allow-downloads"
echo "all checks passed"
