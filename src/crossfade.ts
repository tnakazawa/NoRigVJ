import { disposeLayer, resizeLayer, type Layer } from "./layer";
import { TICK_INTERVAL_MS } from "./shared";

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

  if (durationMs <= 0) {
    // durationMsが0だと、setTimeout(0)が2重requestAnimationFrame(次フレーム以降)より
    // 先に発火することがあり、toLayerがopacity:0のまま完了してしまう(画面が暗転したまま
    // 見えなくなる)レースコンディションが起きうる。見た目は即座にopacity:1にして切り替える。
    //
    // ただし完了処理(dispose・onComplete)まで同期的に呼んでしまうと、control.ts側では
    // 呼び出し元の`entry.crossfadingInstructionId`がセットされている時間が実質0になり、
    // 33ms間隔で状態をBroadcastChannelへ送る`tick()`がその状態を一度も観測できないまま
    // 完了してしまう。結果、投影窓側には「切り替えろ」という指示(`crossfadeByWindow`)が
    // 一度も届かず、操作UI側のプレビューだけが切り替わって投影窓は反映されない、という
    // バグが実際に起きていた。tick()の周期(TICK_INTERVAL_MS、tick-worker.tsと同じ値)より
    // 長く待ってから完了処理を呼ぶことで、最低1回はtick()に観測される時間を確保する。
    toLayer.wrapEl.style.opacity = "1";
    containerEl.appendChild(toLayer.wrapEl);
    setTimeout(() => {
      disposeLayer(fromLayer);
      onComplete(toLayer);
    }, TICK_INTERVAL_MS * 2);
    return;
  }

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
