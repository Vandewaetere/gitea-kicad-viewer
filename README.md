# gitea-kicad-viewer: view KiCad projects in Gitea

**Browse [KiCad](https://www.kicad.org) schematics, PCBs, 3D boards and BOMs right inside [Gitea](https://about.gitea.com).** Click a `.kicad_sch` or `.kicad_pcb` file in a repository and get an interactive viewer instead of a wall of S-expressions. Everything renders in the browser: no external services, no CDN, no KiCad install needed to look at a design.

> **Status:** early version, works with Gitea 28.2 (tested end-to-end). 3D view and releases still to come.

## Features

- Interactive schematic viewer: pan, zoom, symbol properties, hierarchical sheets
- Interactive PCB viewer: layers on/off, nets, footprints
- BOM view
- Works inside Gitea's own file view through its external renderer: no Gitea patches, no plugin system needed
- Everything is served by your Gitea: no CDN, no external requests, works for private repositories
- Works side by side with [gitea-board-badges](https://github.com/Vandewaetere/gitea-board-badges) in the same `$GITEA_CUSTOM`

## How it works

Gitea runs `render.sh` for every KiCad file it shows and puts the result in a sandboxed iframe. That page loads
[ecad-viewer](https://github.com/Huaqiu-Electronics/ecad-viewer) from Gitea's `/assets/kicad-viewer/`, plus a small
loader that makes the viewer work inside Gitea's sandbox.

| Gitea sandbox | What you see |
|---|---|
| default (`allow-scripts …`) | the file you opened (one schematic sheet or one PCB) |
| with `allow-same-origin` | the whole project in that folder: all sheets, the PCB and the BOM, in tabs |

`allow-same-origin` lets the viewer read the other files of the project with the visitor's own session. Only add it
if you trust the render command (this one only reads files, it never puts their content into the page as HTML).

## Installation

Build (needs Docker and git; the build runs in the official Node.js image):

```sh
./build.sh
```

This fills `dist/`. Copy `dist/public/assets/kicad-viewer/` to `$GITEA_CUSTOM/public/assets/kicad-viewer/` and
`dist/kicad-viewer/render.sh` to a place Gitea can run it, then add to `app.ini`:

```ini
[markup.kicad]
ENABLED             = true
FILE_EXTENSIONS     = .kicad_sch,.kicad_pcb,.kicad_pro
RENDER_COMMAND      = sh /data/kicad-viewer/render.sh
RENDER_CONTENT_MODE = iframe
; optional, to see whole projects (see above):
; RENDER_CONTENT_SANDBOX = allow-scripts allow-same-origin allow-popups allow-downloads
```

Restart Gitea. With the official Docker image `$GITEA_CUSTOM` is `/data/gitea`. If Gitea runs under a sub-path, set
`KICAD_VIEWER_ASSETS` (default `/assets/kicad-viewer`) in the environment of the render command.

Large boards: Gitea does not render files above `[ui] MAX_DISPLAY_FILE_SIZE` (default 8 MiB). Raise it if your
`.kicad_pcb` files are bigger. Opening the `.kicad_pro` with `allow-same-origin` loads the PCB directly and is not limited.

## Example project

[`examples/rp2350-minimal/`](examples/rp2350-minimal/) holds a small, validated, MIT-licensed KiCad 10 project to try
the viewer with: Raspberry Pi's official RP2350A Minimal Design (where it comes from, license and validation are in its
[README](examples/rp2350-minimal/README.md)). Push it to a repository on your Gitea and open the `.kicad_pro`.

## Test

```sh
./build.sh && test/test.sh
```

Starts a throwaway Gitea (official image) on an internal Docker network, with this viewer and gitea-board-badges
installed, pushes ecad-viewer's demo project and the example project to a private repository and checks the result in Chromium (Microsoft's
official Playwright image), with and without `allow-same-origin`. Nothing touches any other Gitea.

## Credits

This project is built on the work of others, thank you:

- **[ecad-viewer](https://github.com/Huaqiu-Electronics/ecad-viewer)** by **Huaqiu Electronics** (MIT): the viewer this project is based on.
- **[KiCanvas](https://github.com/theacodes/kicanvas)** by **Thea Flowers** (MIT): the KiCad web viewer ecad-viewer itself is based on.
- **[Raspberry Pi Ltd](https://www.raspberrypi.com)** (MIT): the example project in `examples/rp2350-minimal/`.
- **[three-gltf-viewer](https://github.com/donmccurdy/three-gltf-viewer)** by **Don McCurdy** (MIT): used by ecad-viewer for the 3D view.

Inside Gitea the loader hides ecad-viewer's logo in the corner of the viewer; the credits are here instead. Their
license notices are kept with the code taken from them; `build.sh` copies ecad-viewer's license next to the
built files. ecad-viewer's bundles also contain [Comlink](https://github.com/GoogleChromeLabs/comlink) (Apache-2.0).

## License

[MIT](LICENSE)
