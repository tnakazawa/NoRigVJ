import type { Palette } from "./scenes/_shared/types";

/** シーケンスモード([specs/013-sequence-mode.md](../specs/013-sequence-mode.md)参照)の1ステップ。
 * sceneIndexではなくシーン名で識別する(シーンファイルの追加・並び替えで既存シーケンスが
 * 別のシーンを指してしまう事故を避けるため、[presets.ts](presets.ts)と同じ方針)。同じシーンを
 * 複数ステップに登場させてよい(1つのシーケンスの中で同じシーンを違うパレット・タイミングで
 * 繰り返し使いたいケースに対応するため、シーン名の重複を禁止していない)。 */
export interface SequenceStep {
  /** UI上でステップを一意に識別するためのid。同じシーンを複数ステップに登場させられるため、
   * `sceneName` だけでは1つのステップを特定できない(ドラッグ&ドロップの並べ替え・削除・
   * パレット変更をどのステップに反映するかの判定に使う)。 */
  id: string;
  sceneName: string;
  palette: Palette;
  /** このステップを表示し続ける時間(ミリ秒)。経過後、次のステップへ進む。
   * ステップごとに個別設定であり、グローバルなAuto intervalとは独立([specs/012-full-auto-mode.md](../specs/012-full-auto-mode.md)の
   * Auto intervalはRandomモード専用になった)。 */
  intervalMs: number;
  /** このステップへ切り替わる際のクロスフェード時間(ミリ秒)。`intervalMs` を超えないようにする
   * (クロスフェードが終わる前に次のステップへ進んでしまう状態を避けるため)。 */
  crossfadeDurationMs: number;
}

/** シーケンス全体の設定。`localStorage` に永続化する。 */
export interface SequenceData {
  steps: SequenceStep[];
}

/** 名前付きで保存された「ステップ一式」。編集中の内容(`SequenceData`)とは別に、
 * 複数のシーケンスをプリセットとして保存・呼び出し・削除できるようにするためのもの。 */
export interface SequencePreset {
  id: string;
  name: string;
  steps: SequenceStep[];
}

const STORAGE_KEY = "norigvj-sequence";
const PRESETS_STORAGE_KEY = "norigvj-sequence-presets";

/** 新規ステップ追加時のデフォルト値。 */
export const DEFAULT_STEP_INTERVAL_MS = 15000;
export const DEFAULT_STEP_CROSSFADE_DURATION_MS = 1000;

function defaultSequence(): SequenceData {
  return { steps: [] };
}

type RawStep = { id?: string; sceneName: string; palette: Palette; intervalMs?: number; crossfadeDurationMs?: number };

/** 未知の形式(古い保存データなど)から`SequenceStep`配列を復元する。`id`/`intervalMs`/
 * `crossfadeDurationMs`が欠けていれば補う。壊れたデータは空配列にフォールバックする。 */
function normalizeSteps(rawSteps: unknown): SequenceStep[] {
  if (!Array.isArray(rawSteps)) return [];
  return (rawSteps as RawStep[]).map((s) => ({
    id: typeof s.id === "string" ? s.id : crypto.randomUUID(),
    sceneName: s.sceneName,
    palette: s.palette,
    intervalMs: typeof s.intervalMs === "number" ? s.intervalMs : DEFAULT_STEP_INTERVAL_MS,
    crossfadeDurationMs:
      typeof s.crossfadeDurationMs === "number" ? s.crossfadeDurationMs : DEFAULT_STEP_CROSSFADE_DURATION_MS,
  }));
}

/** @returns `localStorage` に保存されている、現在編集中のシーケンス設定。壊れているか未保存ならデフォルト値。 */
export function loadSequence(): SequenceData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSequence();
    const parsed = JSON.parse(raw);
    if (!parsed) return defaultSequence();
    return { steps: normalizeSteps(parsed.steps) };
  } catch {
    return defaultSequence();
  }
}

export function saveSequence(data: SequenceData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error("シーケンスの保存に失敗しました", err);
  }
}

/** @returns `localStorage` に保存されている名前付きシーケンスプリセット一覧。壊れているか未保存なら空配列。 */
export function loadSequencePresets(): SequencePreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as { id?: string; name: string; steps: unknown }[]).map((p) => ({
      id: typeof p.id === "string" ? p.id : crypto.randomUUID(),
      name: p.name,
      steps: normalizeSteps(p.steps),
    }));
  } catch {
    return [];
  }
}

function persistSequencePresets(presets: SequencePreset[]): void {
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch (err) {
    console.error("シーケンスプリセットの保存に失敗しました", err);
  }
}

/**
 * 現在編集中のステップ一式を、名前付きプリセットとして新規保存する。
 * @param name プリセット名
 * @param steps 保存対象のステップ一式(値はコピーされる)
 * @returns 生成されたプリセット(id発行済み)
 */
export function saveSequencePreset(name: string, steps: SequenceStep[]): SequencePreset {
  const presets = loadSequencePresets();
  const preset: SequencePreset = {
    id: crypto.randomUUID(),
    name,
    steps: steps.map((s) => ({ ...s, palette: { ...s.palette } })),
  };
  presets.push(preset);
  persistSequencePresets(presets);
  return preset;
}

/** @param id 削除するプリセットのid */
export function deleteSequencePreset(id: string): void {
  const presets = loadSequencePresets().filter((p) => p.id !== id);
  persistSequencePresets(presets);
}
