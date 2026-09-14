import type { Palette } from "./scenes/_shared/types";

/** 名前付きのカラーパレット候補。UIのプリセット選択に使う。 */
export interface PalettePreset {
  name: string;
  palette: Palette;
}

/**
 * 投影窓のパレットUIに表示するプリセット一覧。VJ向けに彩度・コントラストの高い組み合わせを中心に、
 * モノクロ・パステル・アースカラー系まで幅を持たせている(参考: Figma Color Combinations)。
 */
export const PALETTE_PRESETS: PalettePreset[] = [
  { name: "Neon", palette: { main: "#ff00ff", sub: "#00ffff" } },
  { name: "Sunset", palette: { main: "#ff6a00", sub: "#7b2ff7" } },
  { name: "Mono", palette: { main: "#ffffff", sub: "#888888" } },
  { name: "Fire", palette: { main: "#ff3300", sub: "#ffcc00" } },
  { name: "Ocean", palette: { main: "#00c2ff", sub: "#0044ff" } },
  { name: "Watermelon", palette: { main: "#ff2d55", sub: "#7ed957" } },
  { name: "Cobalt Sky", palette: { main: "#0047ab", sub: "#00d4ff" } },
  { name: "Grape", palette: { main: "#6a0dad", sub: "#ff69b4" } },
  { name: "Lime Punch", palette: { main: "#d4ff00", sub: "#ff00aa" } },
  { name: "Cyberpunk", palette: { main: "#ff003c", sub: "#00fff9" } },
  { name: "Toxic", palette: { main: "#39ff14", sub: "#ff00ff" } },
  { name: "Bubblegum", palette: { main: "#ff6ec7", sub: "#7afcff" } },
  { name: "Lavender Dream", palette: { main: "#b19cd9", sub: "#ffd1dc" } },
  { name: "Peach Fizz", palette: { main: "#ffb997", sub: "#f67e7d" } },
  { name: "Mint Cream", palette: { main: "#a8e6cf", sub: "#6fcf97" } },
  { name: "Rose Quartz", palette: { main: "#f7cac9", sub: "#6a89cc" } },
  { name: "Champagne Gold", palette: { main: "#f7e7ce", sub: "#d4af37" } },
  { name: "Quiet Luxury", palette: { main: "#e8d5b7", sub: "#8b5a3c" } },
  { name: "Burnt Sienna", palette: { main: "#e97451", sub: "#4a2c17" } },
  { name: "Desert Sand", palette: { main: "#edc9af", sub: "#c19a6b" } },
  { name: "Forest", palette: { main: "#2ecc71", sub: "#0b3d0b" } },
  { name: "Stormy Morning", palette: { main: "#8fa1a3", sub: "#2c3e50" } },
  { name: "Charcoal Ice", palette: { main: "#2b2d42", sub: "#8d99ae" } },
  { name: "Deep Space", palette: { main: "#6a0dad", sub: "#0b0033" } },
  { name: "Aurora", palette: { main: "#00ff87", sub: "#60efff" } },
  { name: "Volt", palette: { main: "#d0ff00", sub: "#00ffd0" } },
  { name: "Blood Moon", palette: { main: "#ff4500", sub: "#8b0000" } },
  { name: "Ice Fire", palette: { main: "#ff4500", sub: "#00bfff" } },
  { name: "Golden Hour", palette: { main: "#ffd700", sub: "#ff6347" } },
  { name: "Amethyst", palette: { main: "#9966cc", sub: "#e6e6fa" } },
  { name: "Emerald City", palette: { main: "#50c878", sub: "#00332e" } },
  { name: "Coral Reef", palette: { main: "#ff7f50", sub: "#40e0d0" } },
];

/** 新規レイヤー・投影窓の初期パレット。 */
export const DEFAULT_PALETTE: Palette = PALETTE_PRESETS[0].palette;
