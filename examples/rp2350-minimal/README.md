# Example project: Raspberry Pi RP2350A Minimal Design (R4-S1)

A small, real-world KiCad project to try gitea-kicad-viewer with: push this folder to a Gitea repository with the
viewer installed and open the `.kicad_pro` (whole project), the `.kicad_sch` or the `.kicad_pcb`.

## Where it comes from

This is the official **RP2350A QFN-60 Minimal Design Example, revision R4-S1**, made by **Raspberry Pi Ltd** as the
reference design that goes with their guide [Hardware design with RP2350](https://datasheets.raspberrypi.com/rp2350/hardware-design-with-rp2350.pdf).

- Source: [`Minimal-KiCAD.zip`](https://datasheets.raspberrypi.com/rp2350/Minimal-KiCAD.zip) from
  [datasheets.raspberrypi.com](https://datasheets.raspberrypi.com), downloaded 28 October 2026
  (SHA-256 of the zip: `c0b858d78f56fa271a827064198e8ee81e4ec246234ce6659be8a1fcd877d06b`).
- License: MIT, Copyright (c) 2026 Raspberry Pi Ltd, see [LICENSE.txt](LICENSE.txt) (copied unchanged from the zip).
- Files: the `.kicad_pro`, `.kicad_sch` and `.kicad_pcb` from the zip, **unchanged**. Left out: the PDF schematic and
  the BOM spreadsheet, which are also in the zip.
- Format: KiCad 10 (`generator_version "10.0"`).

Raspberry Pi provides the design for guidance only and without guarantee (see the disclaimer in LICENSE.txt). It is
not affiliated with this project.

## Why this one

- Small but real: one schematic sheet, a 2-layer board, 43 footprints (RP2350A, QSPI flash, USB-C, crystal,
  regulator, buttons, two pin headers), all on the top side.
- Carefully designed and reviewed by the chip's own maker.
- Exercises what the viewer has to do: symbols with many pins, labels and power symbols in the schematic; tracks,
  vias, pads, silkscreen and several layers on the board; and a BOM.

## Validation

Checked with KiCad 10.0.7 `kicad-cli` (official KiCad PPA), with only the project files present:

| Check | Result |
|---|---|
| DRC (`pcb drc --schematic-parity`) | **0 errors**, 0 unconnected items, 0 schematic/PCB parity issues |
| ERC (`sch erc`) | 3 errors, all by design (see below) |
| Warnings | library warnings only: Raspberry Pi's own symbol/footprint libraries are not part of the zip (the symbols and footprints themselves are embedded in the files); 2 wire ends off grid |

The 3 ERC errors are the usual false positives of a reference design without `PWR_FLAG` symbols:

- *Power output connected to power output*: the two `OUT` pins of the regulator U2 are tied together on purpose.
- *Power input not driven* on `VREG_AVDD` (U1 pin 46): it is fed from 3.3 V through an RC filter, so ERC sees no
  power output on that net.
- *Power input not driven* on `+1V1`: that rail comes from the RP2350's internal regulator.
