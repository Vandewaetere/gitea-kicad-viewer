# Changelog

Every release is a tag `vX.Y.Z` with a section `## [X.Y.Z]` here; the release on GitHub gets that section as its notes
and `gitea-kicad-viewer.tar.gz` (the built viewer) as its download. The version is also at the top of `src/loader.js`.

## [1.0.0] - 2026-10-28

First release.

- KiCad files (`.kicad_pro`, `.kicad_sch`, `.kicad_pcb`) open in an interactive viewer in Gitea's file view, through
  Gitea's external renderer (`[markup.kicad]`, iframe mode). Based on ecad-viewer by Huaqiu Electronics.
- Works with Gitea's default sandbox (the opened file) and, with `allow-same-origin`, shows the whole project of the
  folder: all sheets, the PCB, the BOM and a 3D view from a `.glb` next to the project.
- Everything is served by Gitea itself: no CDN, no external requests; works for private repositories.
- Asset URLs carry the build version, so browsers pick up a new release right away.
- Example project: Raspberry Pi's RP2350A Minimal Design (MIT), with its 3D model.
- End-to-end test in a throwaway Gitea, together with gitea-board-badges.
