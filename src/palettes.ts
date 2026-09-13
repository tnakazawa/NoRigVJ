import type { Palette } from "./scenes/_shared/types";

export interface PalettePreset {
  name: string;
  palette: Palette;
}

export const PALETTE_PRESETS: PalettePreset[] = [
  { name: "Neon", palette: { main: "#ff00ff", sub: "#00ffff" } },
  { name: "Sunset", palette: { main: "#ff6a00", sub: "#7b2ff7" } },
  { name: "Mono", palette: { main: "#ffffff", sub: "#888888" } },
  { name: "Fire", palette: { main: "#ff3300", sub: "#ffcc00" } },
  { name: "Ocean", palette: { main: "#00c2ff", sub: "#0044ff" } },
];

export const DEFAULT_PALETTE: Palette = PALETTE_PRESETS[0].palette;
