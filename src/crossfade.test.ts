import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startCrossfade } from "./crossfade";
import { disposeLayer, resizeLayer, type Layer } from "./layer";
import { TICK_INTERVAL_MS } from "./shared";

// layer.tsはthree.js(WebGLRenderer)に依存するため、レイヤー操作だけをモックする
vi.mock("./layer", () => ({
  disposeLayer: vi.fn(),
  resizeLayer: vi.fn(),
}));

function fakeLayer(): Layer {
  return { wrapEl: document.createElement("div") } as unknown as Layer;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame"] });
  vi.mocked(disposeLayer).mockClear();
  vi.mocked(resizeLayer).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("startCrossfade", () => {
  describe("durationMs > 0", () => {
    it("toLayerはopacity:0で追加され、2フレーム後に1へ遷移し始める", () => {
      const container = document.createElement("div");
      const from = fakeLayer();
      const to = fakeLayer();
      startCrossfade(container, from, to, 800, 600, 1000, vi.fn());

      expect(container.contains(to.wrapEl)).toBe(true);
      expect(to.wrapEl.style.opacity).toBe("0");
      expect(to.wrapEl.style.transition).toBe("opacity 1000ms linear");

      vi.advanceTimersToNextFrame();
      expect(to.wrapEl.style.opacity).toBe("0");
      vi.advanceTimersToNextFrame();
      expect(to.wrapEl.style.opacity).toBe("1");
    });

    it("durationMs経過するまでfromLayerは破棄されず、経過後に破棄してonCompleteを呼ぶ", () => {
      const onComplete = vi.fn();
      const from = fakeLayer();
      const to = fakeLayer();
      startCrossfade(document.createElement("div"), from, to, 800, 600, 1000, onComplete);

      vi.advanceTimersByTime(999);
      expect(disposeLayer).not.toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(disposeLayer).toHaveBeenCalledWith(from);
      expect(onComplete).toHaveBeenCalledWith(to);
    });

    it("toLayerを指定サイズへリサイズする", () => {
      const to = fakeLayer();
      startCrossfade(document.createElement("div"), fakeLayer(), to, 800, 600, 1000, vi.fn());
      expect(resizeLayer).toHaveBeenCalledWith(to, 800, 600);
    });
  });

  describe("durationMs <= 0", () => {
    it("見た目は即座にopacity:1になる(暗転したまま残らない)", () => {
      const container = document.createElement("div");
      const to = fakeLayer();
      startCrossfade(container, fakeLayer(), to, 800, 600, 0, vi.fn());

      expect(container.contains(to.wrapEl)).toBe(true);
      expect(to.wrapEl.style.opacity).toBe("1");
    });

    // 回帰テスト: 完了処理を同期的に呼ぶと、呼び出し元がセットする
    // `crossfadingInstructionId`の寿命が実質0になり、TICK_INTERVAL_MS間隔のtick()が
    // 状態を一度も観測できないまま完了し、投影窓へ指示が届かないバグがあった
    // (specs/006-scene-crossfade.md参照)。
    it("完了処理はTICK_INTERVAL_MSより長く遅延され、tick()が最低1回観測できる", () => {
      const onComplete = vi.fn();
      const from = fakeLayer();
      const to = fakeLayer();
      startCrossfade(document.createElement("div"), from, to, 800, 600, 0, onComplete);

      expect(onComplete).not.toHaveBeenCalled();
      expect(disposeLayer).not.toHaveBeenCalled();

      vi.advanceTimersByTime(TICK_INTERVAL_MS);
      expect(onComplete).not.toHaveBeenCalled();

      vi.advanceTimersByTime(TICK_INTERVAL_MS);
      expect(disposeLayer).toHaveBeenCalledWith(from);
      expect(onComplete).toHaveBeenCalledWith(to);
    });

    it("負の値も0と同じ扱いになる", () => {
      const onComplete = vi.fn();
      const to = fakeLayer();
      startCrossfade(document.createElement("div"), fakeLayer(), to, 800, 600, -100, onComplete);

      expect(to.wrapEl.style.opacity).toBe("1");
      vi.advanceTimersByTime(TICK_INTERVAL_MS * 2);
      expect(onComplete).toHaveBeenCalledWith(to);
    });
  });
});
