/**
 * Canvas 2Dの `hsl()` カラー文字列を組み立てる(パレット非対応シーン用)。
 * @param h 色相(0-360、範囲外はラップする)
 * @param s 彩度(0-100)
 * @param l 明度(0-100)
 */
export function hsl(h: number, s: number, l: number): string {
  return `hsl(${h % 360}, ${s}%, ${l}%)`;
}

/**
 * 16進カラーコードを、各成分0-1に正規化したRGB(WebGLのuniform等で使う形)に変換する。
 * @param hex 例: "#ff00ff"
 * @returns `[r, g, b]`(各0-1)
 */
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * メイン/サブの2色を t(0-1) で線形補間し、Canvas 2Dで使える rgb() 文字列を返す
 * @param hexA t=0 のときの色
 * @param hexB t=1 のときの色
 * @param t 補間係数(0-1)
 */
export function lerpColor(hexA: string, hexB: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  const r = Math.round((r1 + (r2 - r1) * t) * 255);
  const g = Math.round((g1 + (g2 - g1) * t) * 255);
  const b = Math.round((b1 + (b2 - b1) * t) * 255);
  return `rgb(${r}, ${g}, ${b})`;
}
