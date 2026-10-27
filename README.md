# gitea-kicad-viewer: view KiCad projects in Gitea

**Browse [KiCad](https://www.kicad.org) schematics, PCBs, 3D boards and BOMs right inside [Gitea](https://about.gitea.com).** Click a `.kicad_sch` or `.kicad_pcb` file in a repository and get an interactive viewer instead of a wall of S-expressions. Everything renders in the browser: no external services, no CDN, no KiCad install needed to look at a design.

> **Status:** work in progress, nothing to install yet.

## Planned features

- Interactive schematic viewer (hierarchical sheets, nets, symbol properties)
- Interactive PCB viewer (layers on/off, nets, footprints)
- 3D board view and BOM
- Hooks into Gitea through its external markup renderer, so it works on any Gitea instance without patching Gitea
- Works side by side with [gitea-board-badges](https://github.com/Vandewaetere/gitea-board-badges): both can live in the same `$GITEA_CUSTOM` directory

## Credits

This project is built on the work of others, thank you:

- **[ecad-viewer](https://github.com/Huaqiu-Electronics/ecad-viewer)** by **Huaqiu Electronics** (MIT): the viewer this project is based on.
- **[KiCanvas](https://github.com/theacodes/kicanvas)** by **Thea Flowers** (MIT): the KiCad web viewer ecad-viewer itself is based on.
- **[three-gltf-viewer](https://github.com/donmccurdy/three-gltf-viewer)** by **Don McCurdy** (MIT): used by ecad-viewer for the 3D view.

Their license notices are kept with the code taken from them.

## License

[MIT](LICENSE)
