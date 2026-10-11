import { describe, expect, it } from "vitest";
import { normalizePadPosition } from "./pad";

const rect = { left: 100, top: 50, width: 200, height: 100 };

describe("normalizePadPosition", () => {
  it("パッドの中心は(0,0)", () => {
    expect(normalizePadPosition(200, 100, rect)).toEqual({ x: 0, y: 0 });
  });

  it("左上は(-1,-1)、右下は(1,1)", () => {
    expect(normalizePadPosition(100, 50, rect)).toEqual({ x: -1, y: -1 });
    expect(normalizePadPosition(300, 150, rect)).toEqual({ x: 1, y: 1 });
  });

  it("軸ごとに独立して正規化される", () => {
    expect(normalizePadPosition(250, 75, rect)).toEqual({ x: 0.5, y: -0.5 });
  });

  it("パッドの外へドラッグしても-1〜1にクランプされる", () => {
    expect(normalizePadPosition(-1000, -1000, rect)).toEqual({ x: -1, y: -1 });
    expect(normalizePadPosition(1000, 1000, rect)).toEqual({ x: 1, y: 1 });
  });
});
