import { beforeEach, describe, expect, it } from "vitest";
import { deletePreset, loadPresets, savePreset } from "./presets";

const STORAGE_KEY = "norigvj-scene-presets";

beforeEach(() => {
  localStorage.clear();
});

describe("presets", () => {
  it("未保存なら空配列", () => {
    expect(loadPresets()).toEqual([]);
  });

  it("保存したプリセットを読み戻せる", () => {
    const saved = savePreset("My Preset", "Pulse Rings", { main: "#ff00ff", sub: "#00ffff" });
    expect(saved.id).toBeTruthy();
    expect(loadPresets()).toEqual([saved]);
  });

  it("パレットは参照ではなくコピーして保存される", () => {
    const palette = { main: "#ff00ff", sub: "#00ffff" };
    const saved = savePreset("p", "Pulse Rings", palette);
    palette.main = "#000000";
    expect(saved.palette.main).toBe("#ff00ff");
  });

  it("idを指定して削除でき、他のプリセットは残る", () => {
    const a = savePreset("a", "Pulse Rings", { main: "#111111", sub: "#222222" });
    const b = savePreset("b", "Aurora", { main: "#333333", sub: "#444444" });
    deletePreset(a.id);
    expect(loadPresets()).toEqual([b]);
  });

  it("保存データが壊れたJSONでも空配列にフォールバックする", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadPresets()).toEqual([]);
  });

  it("保存データが配列でなくても空配列にフォールバックする", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 1 }));
    expect(loadPresets()).toEqual([]);
  });
});
