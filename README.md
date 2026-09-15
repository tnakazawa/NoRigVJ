# NoRigVJ

An interactive VJ (Visual Jockey) application that runs in the browser.
It analyzes microphone input in real time and generates visuals from it.
No special audio interface or MIDI gear required.

## Setup

```bash
npm install
npm run dev
```

Open `/control.html` at the URL shown (e.g. http://localhost:5173/control.html).

## Structure

- **Control UI (control.html)** — The screen for microphone analysis (shared across all displays), intensity adjustment, and per-display scene/color palette selection. Each display row has its own preview. The UI is in English.
- **Display window (display.html)** — A visuals-only fullscreen window opened via the "Add Display" button in the control UI. There's no limit on how many you can open, and each one can have its own scene and colors. Meant to be shown on an external monitor or projector.

The control UI and each display window stay in sync via the browser's `BroadcastChannel` API, all within the same PC and same origin.

## Scenes

Every scene renders with WebGL (three.js). Each scene is one file under `src/scenes/`, and simply adding a file makes it automatically available in the scene picker (an earlier version mixed WebGL with Canvas 2D, but everything was unified onto WebGL for both looks and performance).

- **Pulse Rings** — Concentric rings (tori) that react to volume. Supports the color palette.
- **Bar Spectrum** — 3D bars that ripple with the low end, colored main→sub by bar position. Supports the color palette.
- **Noise Field** — A particle cloud that scatters with the high end. Supports the color palette.
- **Feedback Loop** — A feedback-loop effect that layers and distorts the previous frame's render. Supports the color palette.
- **Plasma Lava** — A classic plasma/lava pattern made of overlapping sine waves. Supports the color palette.
- **Wireframe Polyhedron** — Several rotating wireframe polyhedra in a composition with depth. Supports the color palette.
- **Kaleidoscope** — A kaleidoscope-like repeating pattern from angular polar-coordinate division. Supports the color palette.
- **Grid Terrain** — A wireframe terrain that ripples with the audio, in an overhead composition with depth. Supports the color palette.
- **Bloom Particles** — An additively-blended particle cloud with bloom (glow). Supports the color palette.
- **Rainbow** — Rainbow-colored parallel lines filling the screen, continuously scrolling from top to bottom. Does not support the color palette, since the rainbow coloring itself is the point.
- **Starfield Warp** — Countless stars streaming toward the camera, warp-drive style. Supports the color palette.
- **Metaball Blob** — A single organically writhing blob-like sphere. Supports the color palette.
- **Halftone Dots** — A grid of circular dots that grow and shrink with the audio, print-halftone style. Supports the color palette.
- **Lissajous Lines** — A glowing line tracing a Lissajous curve. The only line-art scene. Supports the color palette.
- **Voronoi Cells** — A Voronoi (Worley noise) pattern with irregular cell boundaries. Supports the color palette.
- **Instanced Cube Grid** — A grid of 3D cubes that bob up and down with the audio, viewed from above like a city skyline. Supports the color palette.
- **Matrix Rain** — Digital-code-style blocks streaming downward column by column, cyberpunk style. Supports the color palette.
- **DNA Helix** — A double helix of rotating spheres with connecting base-pair rungs. Supports the color palette.
- **Fireworks** — Multiple shells burst on a cycle, arc under gravity, and fade out. Supports the color palette.
- **Fresnel Glass Sphere** — A translucent sphere whose rim glows via a fresnel effect. Supports the color palette.
- **Radial Rays** — Rays radiating from the center, flickering. Supports the color palette.
- **Aurora** — Aurora-like light curtains billowing across the screen. Supports the color palette.
- **Spiral Galaxy** — A particle galaxy with a spiral swirl. Supports the color palette.
- **Flocking Boids** — A particle swarm that moves autonomously like a flock of birds or school of fish. Supports the color palette.
- **Bouncing Balls** — A group of balls bouncing under simple physics. Supports the color palette.
- **Chladni Patterns** — Chladni figures, where sand gathers on a vibrating plate. Supports the color palette.
- **Sacred Geometry Mandala** — Overlapping rings forming a "Flower of Life" style geometric pattern. Supports the color palette.
- **Lightning Arcs** — Jagged lightning-bolt lines flickering. Supports the color palette.
- **Glitch Blocks** — Digital glitch noise where the screen breaks up block by block. Supports the color palette.
- **Radial Bar Spectrum** — Bars arranged in a circle that stretch radially with the audio, like a vinyl-record spectrum analyzer. Supports the color palette.
- **Origami Folding Planes** — A plane that opens and closes like an accordion origami fold. Supports the color palette.
- **Ribbon Wave** — A tube-shaped ribbon undulating in waves. Supports the color palette.

## Color palette

Each display can have its own main/sub two-color palette. Choose from 32 presets, or pick freely with the color pickers. The preset dropdown shows a main/sub color swatch to the left of each entry, so you can preview the colors without selecting them. While a palette-unsupported scene (Rainbow) is selected, the palette UI is disabled.

## Scene presets

You can save a per-display "scene + color palette" combination under a name. Saved presets can be recalled from any display and are stored in the browser's `localStorage`, so they survive a page reload. Intensity is a value shared across all displays, so it isn't included in presets. The name field defaults to `{scene name}-{main color}-{sub color}` (e.g. `Pulse Rings-#ff00ff-#00ffff`) when saving, which you can use as-is or overwrite.

## Scene switching and crossfade

Per-display scene selection, palette settings, and preset selection don't take effect just by choosing them — they all edit the "pending" content (what to switch to next), and the actual switch only happens when you press the "Crossfade" button. The display transitions smoothly from what's currently shown to the pending content over a set duration (adjustable via the panel's "Crossfade duration" slider, shared across all displays). The button is disabled when the pending content matches what's currently shown. Each display row always shows a "Next" preview next to the "Current" one, so you can check what the pending content looks like before committing.

## Manual trigger effects

One-shot effects the VJ fires with a button or key at just the right moment (an earlier attempt at automatic BPM detection was abandoned for insufficient accuracy — see below). There are three, "Trigger 1", "Trigger 2", and "Trigger 3", and pressing one makes every display (including the control UI's previews) react simultaneously. Which effects a scene has varies by scene, and the button is disabled while a scene with no matching effect is shown (30 of the 32 scenes support triggers; only Plasma Lava and Grid Terrain don't).

- **Pulse Rings**: Trigger 1 = Ring Burst (spawns a new ring that bursts outward) / Trigger 2 = Color Flip (briefly reverses the coloring) / Trigger 3 = Radius Kick (briefly enlarges all rings)
- **Bar Spectrum**: Trigger 1 = Height Kick (briefly stretches all bars) / Trigger 2 = Color Flip (briefly reverses the coloring) / Trigger 3 = White Flash (briefly flashes white)
- **Noise Field**: Trigger 1 = Radial Push (pushes particles outward radially) / Trigger 2 = Freeze (briefly freezes motion) / Trigger 3 = Color Flash (briefly flashes white)
- **Feedback Loop**: Trigger 1 = Zoom Punch (briefly intensifies the swirl distortion) / Trigger 2 = Flash (briefly intensifies the center glow) / Trigger 3 = Invert (briefly inverts the coloring)
- **Wireframe Polyhedron**: Trigger 1 = Spin Kick (briefly boosts rotation speed) / Trigger 2 = Scale Pulse (briefly enlarges all polyhedra) / Trigger 3 = Flash (briefly flashes white)
- **Kaleidoscope**: Trigger 1 = Segment Kick (briefly increases the segment count) / Trigger 2 = Spin Burst (briefly boosts rotation speed) / Trigger 3 = Flash (briefly brightens)
- **Bloom Particles**: Trigger 1 = Radial Burst (pushes particles outward radially) / Trigger 2 = Bloom Flash (briefly intensifies the glow) / Trigger 3 = Freeze (briefly freezes motion)
- **Rainbow**: Trigger 1 = Monochrome (briefly desaturates to grayscale) / Trigger 2 = Pale (briefly fades toward white) / Trigger 3 = Darken (briefly deepens toward black)
- **Starfield Warp**: Trigger 1 = Warp Speed (briefly boosts speed sharply) / Trigger 2 = Flash (briefly makes stars bigger and white)
- **Metaball Blob**: Trigger 1 = Spike (briefly deforms into spikes) / Trigger 2 = Smooth (briefly reverts to a perfect sphere)
- **Halftone Dots**: Trigger 1 = Invert (briefly swaps dot/background coloring) / Trigger 2 = Zoom (briefly changes dot density) / Trigger 3 = Flash (briefly flashes white)
- **Lissajous Lines**: Trigger 1 = Ratio Kick (briefly changes the frequency ratio, distorting the pattern) / Trigger 2 = Flash (briefly glows white)
- **Voronoi Cells**: Trigger 1 = Shuffle (briefly changes the grid density, reshuffling the pattern) / Trigger 2 = Flash (briefly flashes white)
- **Instanced Cube Grid**: Trigger 1 = Height Kick (briefly lifts all cubes) / Trigger 2 = Wave Pulse (briefly intensifies the ripple from the center) / Trigger 3 = White Flash (briefly flashes white)
- **Matrix Rain**: Trigger 1 = Speed Burst (briefly boosts the scroll speed) / Trigger 2 = Flash (briefly flashes white)
- **DNA Helix**: Trigger 1 = Spin Kick (briefly boosts rotation speed) / Trigger 2 = Radius Pulse (briefly widens the helix) / Trigger 3 = Flash (briefly flashes white)
- **Fireworks**: Trigger 1 = Launch Burst (briefly boosts the explosion force) / Trigger 2 = Flash (briefly flashes white)
- **Fresnel Glass Sphere**: Trigger 1 = Glow Burst (briefly intensifies the rim glow) / Trigger 2 = Core Flash (briefly makes the core glow white too)
- **Radial Rays**: Trigger 1 = Burst (briefly widens the glow radius) / Trigger 2 = Spin (briefly boosts rotation speed)
- **Aurora**: Trigger 1 = Brighten (briefly intensifies the glow) / Trigger 2 = Ripple (briefly makes the waves shake violently)
- **Spiral Galaxy**: Trigger 1 = Spin Burst (briefly boosts rotation speed) / Trigger 2 = Flash (briefly flashes white)
- **Flocking Boids**: Trigger 1 = Scatter (briefly strengthens separation, scattering the flock) / Trigger 2 = Flash (briefly flashes white)
- **Bouncing Balls**: Trigger 1 = Bounce Burst (gives every ball an upward kick) / Trigger 2 = Flash (briefly flashes white)
- **Chladni Patterns**: Trigger 1 = Mode Shift (briefly changes the vibration mode, reshuffling the pattern) / Trigger 2 = Flash (briefly flashes white)
- **Sacred Geometry Mandala**: Trigger 1 = Bloom (briefly expands like a flower opening) / Trigger 2 = Spin Burst (briefly boosts rotation speed) / Trigger 3 = Flash (briefly flashes white)
- **Lightning Arcs**: Trigger 1 = Strike (forces every bolt to fire at once) / Trigger 2 = Flash (briefly flashes white)
- **Glitch Blocks**: Trigger 1 = Corrupt (briefly maximizes the glitching) / Trigger 2 = Flash (briefly flashes white)
- **Radial Bar Spectrum**: Trigger 1 = Height Kick (briefly stretches all bars) / Trigger 2 = Color Flip (briefly reverses the coloring) / Trigger 3 = White Flash (briefly flashes white)
- **Origami Folding Planes**: Trigger 1 = Fold (briefly folds deeply) / Trigger 2 = Flatten (briefly opens flat) / Trigger 3 = Flash (briefly flashes white)
- **Ribbon Wave**: Trigger 1 = Wave Kick (briefly intensifies the wave amplitude) / Trigger 2 = Flash (briefly flashes white)

## Controls (control UI)

The UI is in English.

| Key / UI | Action |
|---|---|
| M / "Enable Mic" / "Disable Mic" button | Toggles the microphone on/off (shared across all displays) |
| ← / → / "Intensity" slider | Adjusts effect intensity (shared across all displays) |
| "Crossfade duration" slider | Adjusts the scene-switch transition time (shared across all displays) |
| Per-display scene selector | Reserves the next scene to switch to |
| Per-display palette controls | Reserves the next colors to switch to, via preset or color pickers |
| Per-display "Save Preset" / selector / "Delete" | Saves/deletes the current scene+palette under a name. Recalling one updates the reservation |
| Per-display "Crossfade" button | Actually switches the display to the reserved content |
| Space / "Trigger 1" button | Fires Trigger 1 (shared across all displays) |
| Right Cmd (Mac) / Right Ctrl (Windows) / "Trigger 2" button | Fires Trigger 2 (shared across all displays) |
| Left Cmd (Mac) / Left Ctrl (Windows) / "Trigger 3" button | Fires Trigger 3 (shared across all displays) |
| F (on the display window) | Toggles fullscreen |

## Build

```bash
npm run build
npm run preview
```

## Developer docs

See the specs under [specs/](specs/README.md) for the background and design decisions behind the implementation. [CLAUDE.md](CLAUDE.md) has a guide to the codebase as a whole.

## Future ideas

- Beat sync via BPM detection (implemented once on 2026-09-14, but abandoned since detection accuracy wasn't good enough for practical use. A retry would need a more robust detection algorithm)
