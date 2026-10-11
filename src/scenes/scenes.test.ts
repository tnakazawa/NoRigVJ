import { describe, expect, it } from "vitest";
import { sceneFactories } from "./index";

// 全シーンのメタデータ(src/scenes/CLAUDE.mdに記載の不変条件)を検証する。
// 描画結果(シェーダーの見た目)はWebGLが必要なため対象外。
const scenes = sceneFactories.map((factory) => factory());

describe("scenes metadata", () => {
  it("シーンが1つ以上登録されている", () => {
    expect(scenes.length).toBeGreaterThan(0);
  });

  it("シーン名は空でなく、重複しない(プリセット・クロスフェードは名前で遷移先を引くため)", () => {
    const names = scenes.map((s) => s.name);
    expect(names.every((n) => n.length > 0)).toBe(true);
    expect(new Set(names).size).toBe(names.length);
  });

  it("全シーンがrender()を持つ", () => {
    expect(scenes.every((s) => typeof s.render === "function")).toBe(true);
  });

  it("factoryは呼ぶたびに別インスタンスを返す(シーン切替で状態をリセットする設計)", () => {
    const a = sceneFactories[0]();
    const b = sceneFactories[0]();
    expect(a).not.toBe(b);
  });

  it("Blank以外は全てFXパッド対応(Blankは何も描画しないため非対応)", () => {
    const blank = scenes.find((s) => s.name === "Blank");
    expect(blank, "Blankシーンが見つからない").toBeDefined();
    expect(blank!.padSupported).toBeFalsy();
    scenes
      .filter((s) => s !== blank)
      .forEach((s) => expect(s.padSupported, `${s.name} がpadSupported: trueでない`).toBe(true));
  });

  it("パレット非対応なのはBlankとRainbowのみ", () => {
    const unsupported = scenes.filter((s) => !s.supportsPalette).map((s) => s.name);
    expect(unsupported.sort()).toEqual(["Blank", "Rainbow"]);
  });
});
