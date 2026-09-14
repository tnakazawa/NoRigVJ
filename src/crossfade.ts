import { disposeLayer, resizeLayer, type Layer } from "./layer";

/**
 * `fromLayer` の上に `toLayer` を重ね、CSSの opacity トランジションで見た目のブレンドを
 * ブラウザのコンポジタに任せる(自前でのピクセル合成は行わない)。完了時に `fromLayer` を破棄する。
 * @param containerEl `toLayer.wrapEl` を追加する親要素
 * @param fromLayer 現在表示中のレイヤー。完了時に破棄される
 * @param toLayer 遷移先のレイヤー。事前に生成済みであること
 * @param width レイヤーをリサイズする幅
 * @param height レイヤーをリサイズする高さ
 * @param durationMs トランジションの所要時間(ミリ秒)
 * @param onComplete 完了時に呼ばれるコールバック。`toLayer` が渡される
 */
export function startCrossfade(
  containerEl: HTMLElement,
  fromLayer: Layer,
  toLayer: Layer,
  width: number,
  height: number,
  durationMs: number,
  onComplete: (finishedLayer: Layer) => void,
): void {
  resizeLayer(toLayer, width, height);
  toLayer.wrapEl.style.opacity = "0";
  toLayer.wrapEl.style.transition = `opacity ${durationMs}ms linear`;
  containerEl.appendChild(toLayer.wrapEl);

  // 追加直後に opacity を変えても transition が発火しないブラウザがあるため、
  // 1フレーム待ってから目標値を設定する。
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toLayer.wrapEl.style.opacity = "1";
    });
  });

  setTimeout(() => {
    disposeLayer(fromLayer);
    onComplete(toLayer);
  }, durationMs);
}
