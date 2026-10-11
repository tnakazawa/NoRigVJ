import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_STEP_CROSSFADE_DURATION_MS,
  DEFAULT_STEP_INTERVAL_MS,
  deleteSequencePreset,
  loadSequence,
  loadSequencePresets,
  saveSequence,
  saveSequencePreset,
  type SequenceStep,
} from "./sequence";

const STORAGE_KEY = "norigvj-sequence";
const PRESETS_STORAGE_KEY = "norigvj-sequence-presets";

const palette = { main: "#ff00ff", sub: "#00ffff" };

function step(overrides: Partial<SequenceStep> = {}): SequenceStep {
  return {
    id: "step-1",
    sceneName: "Pulse Rings",
    palette,
    intervalMs: 10000,
    crossfadeDurationMs: 500,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("loadSequence / saveSequence", () => {
  it("未保存なら空のシーケンス", () => {
    expect(loadSequence()).toEqual({ steps: [] });
  });

  it("保存した内容を読み戻せる", () => {
    const data = { steps: [step(), step({ id: "step-2", sceneName: "Aurora" })] };
    saveSequence(data);
    expect(loadSequence()).toEqual(data);
  });

  it("壊れたJSONでも空のシーケンスにフォールバックする", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadSequence()).toEqual({ steps: [] });
  });

  it("stepsが配列でなくても空配列にフォールバックする", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ steps: "oops" }));
    expect(loadSequence()).toEqual({ steps: [] });
  });

  it("古い保存形式(id・intervalMs・crossfadeDurationMsなし)はデフォルト値で補われる", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ steps: [{ sceneName: "Aurora", palette }] }));
    const [loaded] = loadSequence().steps;
    expect(loaded.sceneName).toBe("Aurora");
    expect(loaded.id).toBeTruthy();
    expect(loaded.intervalMs).toBe(DEFAULT_STEP_INTERVAL_MS);
    expect(loaded.crossfadeDurationMs).toBe(DEFAULT_STEP_CROSSFADE_DURATION_MS);
  });

  it("crossfadeDurationMsが0でも欠損扱いにせずそのまま保持する", () => {
    saveSequence({ steps: [step({ crossfadeDurationMs: 0 })] });
    expect(loadSequence().steps[0].crossfadeDurationMs).toBe(0);
  });
});

describe("sequence presets", () => {
  it("未保存なら空配列", () => {
    expect(loadSequencePresets()).toEqual([]);
  });

  it("保存したプリセットを読み戻せる", () => {
    const saved = saveSequencePreset("Show 1", [step()]);
    expect(saved.id).toBeTruthy();
    expect(loadSequencePresets()).toEqual([saved]);
  });

  it("ステップのパレットはコピーして保存される", () => {
    const original = step({ palette: { main: "#111111", sub: "#222222" } });
    const saved = saveSequencePreset("Show 1", [original]);
    original.palette.main = "#ffffff";
    expect(saved.steps[0].palette.main).toBe("#111111");
  });

  it("idを指定して削除でき、他のプリセットは残る", () => {
    const a = saveSequencePreset("a", [step()]);
    const b = saveSequencePreset("b", [step({ id: "step-2" })]);
    deleteSequencePreset(a.id);
    expect(loadSequencePresets()).toEqual([b]);
  });

  it("壊れたJSONや配列でない保存データは空配列にフォールバックする", () => {
    localStorage.setItem(PRESETS_STORAGE_KEY, "{not json");
    expect(loadSequencePresets()).toEqual([]);
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify({ foo: 1 }));
    expect(loadSequencePresets()).toEqual([]);
  });
});
