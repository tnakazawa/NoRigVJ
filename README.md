# NoRigVJ

An interactive VJ (Visual Jockey) application that runs in the browser.
It analyzes microphone input in real time and generates visuals from it.
No special audio interface or MIDI gear required.

## Live demo

https://tnakazawa.github.io/NoRigVJ/

Hosted on GitHub Pages, built and deployed automatically from the `main` branch via [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

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

- **Blank** — Renders nothing (a plain black screen). Useful for a blackout between scenes. Does not support the color palette.
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

Each display can have its own main/sub two-color palette. Choose from 32 presets, or pick freely with the color pickers. The preset dropdown shows a main/sub color swatch to the left of each entry, so you can preview the colors without selecting them. While a palette-unsupported scene (Blank, Rainbow) is selected, the palette UI is disabled.

## Scene presets

You can save a per-display "scene + color palette" combination under a name. Saved presets can be recalled from any display and are stored in the browser's `localStorage`, so they survive a page reload. Intensity is a value shared across all displays, so it isn't included in presets. The name field defaults to `{scene name}-{main color}-{sub color}` (e.g. `Pulse Rings-#ff00ff-#00ffff`) when saving, which you can use as-is or overwrite.

## Scene switching and crossfade

Per-display scene selection, palette settings, and preset selection don't take effect just by choosing them — they all edit the "pending" content (what to switch to next), and the actual switch only happens when you press the "Crossfade" button. The display transitions smoothly from what's currently shown to the pending content over a set duration (adjustable via the panel's "Crossfade duration" slider, shared across all displays). The button is disabled when the pending content matches what's currently shown. Each display row always shows a "Next" preview next to the "Current" one, so you can check what the pending content looks like before committing.

## Semi-auto mode (Random)

Press the "Random" button in the panel to instantly randomize every display: each display independently picks a random scene (excluding Blank, and never repeating the scene it was just showing) and a random color palette preset, then crossfades to it using the current Crossfade duration. Intensity is also randomized (shared across all displays, since it's a single value). The button is disabled while no display is connected.

## Full-auto mode

Press the toggle button in the panel to have the app automatically repeat a switch on a timer, without touching anything yourself. Turning it on switches immediately (it doesn't wait for the first interval to elapse before doing anything). The button label shows what clicking it will do: "Auto: ON" when it's off, and "Auto: OFF (next in mm:ss)" — counting down to the next automatic switch — while it's running. Manually pressing a display's "Crossfade" button or the "Random" button turns full-auto off; a manual scene reservation, palette change, preset recall, FX Pad use, Auto mode change, or Intensity/Crossfade duration adjustment does not. The toggle stays enabled even with no displays connected (except, see below, while Sequence mode has an empty sequence).

The "Auto mode" radio buttons choose what full-auto actually does:

- **Random** (default) — repeats the semi-auto randomization above: each display independently picks a random scene and palette. Set the "Auto interval" slider (5-60 seconds) to control how often. The Crossfade duration is never allowed to exceed the Auto interval; it's automatically shortened to match whenever you change the Auto interval, turn full-auto on, or adjust the Crossfade duration while full-auto is on.
- **Sequence** — steps through a fixed, user-defined order instead of picking randomly. The "Auto interval" slider is hidden in this mode, since each step sets its own timing instead. Click "Edit Sequence..." to open the editor: click "+" next to any scene to append it to the sequence (the same scene can be added more than once), drag the list on the right to reorder it, and pick a color palette for each step individually. Every step also has its own "Duration" (how long it stays on screen, 5-60 seconds) and "Crossfade" time (how long the transition into it takes, capped at that step's Duration). The sequence you're currently editing is saved to the browser's `localStorage` and survives a reload. You can also save the whole thing under a name with "Save Sequence", recall a saved one from the dropdown next to it, or remove one with "Delete" — handy for switching between several prepared sequences. Unlike Random, every display advances together and shows the same scene and palette at the same moment — the point is showing everyone the same intended progression, not variety. The Auto toggle is disabled while the sequence is empty.

## FX Pad

A touchpad-like rectangle below the display list, centered under it. Click or drag inside it and every display (including the control UI's previews) reacts in real time to the pointer's position, normalized so the center is (0, 0), the top-left is (-1, -1), and the bottom-right is (1, 1). The X axis and Y axis each drive a different effect (varies by scene): the farther from center, the stronger the effect, and moving past center in the opposite direction flips it the other way (e.g. top-left is the negative of bottom-right). Releasing resets the value to the center (0, 0) instantly — there's no decay to wait out. It's a single shared control (not per-display), and it's disabled while no visible display is showing a scene that supports it. Every scene supports it except Blank, which renders nothing (this replaced the old one-shot Trigger 1/2/3 buttons):

- **Pulse Rings**: X = blends the ring coloring toward its reverse (symmetric — either direction from center does the same thing) / Y = enlarges all rings toward positive, shrinks them toward negative
- **Bar Spectrum**: X = blends the bar coloring toward its reverse (symmetric) / Y = stretches all bars taller toward positive, shorter toward negative
- **Noise Field**: X = fades particle color toward white (positive) or black (negative) / Y = pushes particles outward radially (positive) or pulls them inward (negative)
- **Feedback Loop**: X = blends the previous frame's coloring toward its reverse (symmetric) / Y = amplifies the swirl distortion toward positive, calms it toward negative
- **Plasma Lava**: X = finer plasma pattern toward positive, coarser toward negative / Y = brightens toward positive, dims toward negative
- **Wireframe Polyhedron**: X = speeds up rotation toward positive, reverses it toward negative / Y = fades toward white (positive) or black (negative)
- **Kaleidoscope**: X = adds more segments toward positive, fewer toward negative / Y = brightens toward positive, dims toward negative
- **Grid Terrain**: X = rougher terrain toward positive, flatter toward negative / Y = shifts the overall coloring toward the sub color (positive) or main color (negative)
- **Bloom Particles**: X = pushes particles outward radially (positive) or pulls them inward (negative) / Y = slows the wobble's passage of time toward negative, approaching a freeze
- **Rainbow**: X = desaturates toward grayscale (symmetric) / Y = fades toward white (positive) or black (negative)
- **Starfield Warp**: X = boosts forward speed toward positive, slows it toward negative / Y = fades toward white and bigger (positive) or black and smaller (negative)
- **Metaball Blob**: Y only = spikes the surface toward positive, smooths it toward a perfect sphere toward negative (no natural X-axis effect was found)
- **Halftone Dots**: X = inverts dot/background coloring (symmetric) / Y = finer dot grid toward positive, coarser toward negative
- **Lissajous Lines**: X = distorts the frequency ratio in either direction / Y = fades toward white (positive) or black (negative)
- **Voronoi Cells**: X = denser cells toward positive, coarser cells toward negative / Y = fades toward white (positive) or black (negative)
- **Instanced Cube Grid**: X = fades cube coloring toward white (positive) or black (negative) / Y = raises all cube heights toward positive, lowers them toward negative
- **Matrix Rain**: X = speeds up the falling columns toward positive, slows them toward negative / Y = fades toward white (positive) or black (negative)
- **DNA Helix**: X = speeds up rotation toward positive, reverses it toward negative / Y = enlarges the helix radius toward positive, shrinks it toward negative
- **Fireworks**: X = boosts explosion velocity toward positive, softens it toward negative / Y = fades toward white (positive) or black (negative)
- **Fresnel Glass Sphere**: X = intensifies the rim glow toward positive, dims it toward negative / Y = fades the core toward white (positive) or black (negative)
- **Radial Rays**: X = speeds up rotation toward positive, reverses it toward negative / Y = widens the glow's reach toward positive, narrows it toward negative
- **Aurora**: X = amplifies the wave ripple toward positive, flattens it toward negative / Y = brightens toward positive, dims toward negative
- **Spiral Galaxy**: X = speeds up rotation toward positive, reverses it toward negative / Y = fades toward white (positive) or black (negative)
- **Flocking Boids**: X = fades particle color toward white (positive) or black (negative) / Y = scatters the flock apart (positive) or pulls it into a tighter cluster (negative)
- **Bouncing Balls**: X = fades ball color toward white (positive) or black (negative) / Y = makes balls jump more often and higher (positive) or weighs them down toward the floor (negative)
- **Chladni Patterns**: X = fades toward white (positive) or black (negative) / Y = shifts the vibration mode, rearranging the sand pattern in either direction
- **Sacred Geometry Mandala**: X = fades toward white (positive) or black (negative) / Y = blooms the pattern larger (positive) or shrinks it (negative)
- **Lightning Arcs**: X = fades toward white (positive) or black (negative) / Y = keeps bolts visible much longer, toward near-constant strikes (positive), or shortens how long they're visible (negative)
- **Glitch Blocks**: X = fades toward white (positive) or black (negative) / Y = corrupts more of the screen into glitch blocks (positive) or calms the glitching down (negative)
- **Radial Bar Spectrum**: X = blends the bar coloring toward its reverse (symmetric) / Y = stretches all bars longer toward positive, shorter toward negative
- **Origami Folding Planes**: X = fades toward white (positive) or black (negative) / Y = folds the plane to its sharpest crease (positive) or flattens it out (negative)
- **Ribbon Wave**: X = fades toward white (positive) or black (negative) / Y = amplifies the ribbon's undulation (positive) or flattens it (negative)

## Controls (control UI)

The UI is in English.

| Key / UI | Action |
|---|---|
| M / "Enable Mic" / "Disable Mic" button | Toggles the microphone on/off (shared across all displays) |
| ← / → / "Intensity" slider | Adjusts effect intensity (shared across all displays) |
| "Crossfade duration" slider | Adjusts the scene-switch transition time (shared across all displays) |
| "Random" button | Semi-auto mode: instantly randomizes every display's scene, palette, and Intensity |
| "Auto mode" radio buttons (Random / Sequence) | Chooses what full-auto does. A status label next to the heading always shows the current state, e.g. "(ON / Random)" |
| "Edit Sequence..." button (Sequence mode only) | Opens the sequence editor: click "+" to add a scene (repeats allowed), drag to reorder, set a palette plus its own Duration/Crossfade time per step, and save/recall/delete named sequences |
| "Auto interval" slider (Random mode only) / "Auto" toggle button | Full-auto mode: repeats Random on a timer, or advances the Sequence using each step's own Duration |
| Per-display scene selector | Reserves the next scene to switch to |
| Per-display palette controls | Reserves the next colors to switch to, via preset or color pickers |
| Per-display "Save Preset" / selector / "Delete" | Saves/deletes the current scene+palette under a name. Recalling one updates the reservation |
| Per-display "Crossfade" button | Actually switches the display to the reserved content |
| FX Pad (below the display list) | Click/drag inside the rectangle to drive the FX Pad's X/Y values in real time (shared across all displays; center is (0, 0), edges are ±1); releasing resets both to 0 |
| Drag handle above the FX Pad | Resizes the FX Pad area's height (up to make it bigger); the size is remembered across reloads |
| F (on the display window) | Toggles fullscreen |
| "?" button next to a control | Opens a modal with a short explanation of that control; close it with the "✕" button or by clicking outside |

## Build

```bash
npm run build
npm run preview
```

## Developer docs

See the specs under [specs/](specs/README.md) for the background and design decisions behind the implementation. [CLAUDE.md](CLAUDE.md) has a guide to the codebase as a whole.

## Future ideas

- Beat sync via BPM detection (implemented once on 2026-09-14, but abandoned since detection accuracy wasn't good enough for practical use. A retry would need a more robust detection algorithm)
