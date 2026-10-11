import { describe, expect, it } from "vitest";
import { hexToRgb, lerpColor } from "./color-utils";

describe("hexToRgb", () => {
  it("16進カラーコードを0-1のRGBへ変換する", () => {
    expect(hexToRgb("#000000")).toEqual([0, 0, 0]);
    expect(hexToRgb("#ffffff")).toEqual([1, 1, 1]);
    expect(hexToRgb("#ff0000")).toEqual([1, 0, 0]);
    expect(hexToRgb("#00ff00")).toEqual([0, 1, 0]);
    expect(hexToRgb("#0000ff")).toEqual([0, 0, 1]);
  });

  it("先頭の#がなくても変換できる", () => {
    expect(hexToRgb("ff00ff")).toEqual([1, 0, 1]);
  });
});

describe("lerpColor", () => {
  it("t=0でhexA、t=1でhexBになる", () => {
    expect(lerpColor("#ff0000", "#0000ff", 0)).toBe("rgb(255, 0, 0)");
    expect(lerpColor("#ff0000", "#0000ff", 1)).toBe("rgb(0, 0, 255)");
  });

  it("t=0.5で中間色になる", () => {
    expect(lerpColor("#000000", "#ffffff", 0.5)).toBe("rgb(128, 128, 128)");
  });
});
