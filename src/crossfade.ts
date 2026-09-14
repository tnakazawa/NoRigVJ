import { disposeLayer, resizeLayer, type Layer } from "./layer";

/**
 * fromLayer の上に toLayer を重ね、CSSの opacity トランジションで見た目のブレンドを
 * ブラウザのコンポジタに任せる(自前でのピクセル合成は行わない)。完了時に fromLayer を破棄する。
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
