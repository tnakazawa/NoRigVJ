// バックグラウンドタブ/occludedウィンドウでもタイマーがスロットルされないよう、
// 音声解析・状態送信を駆動するtickだけをWorker側で刻む。
import { TICK_INTERVAL_MS } from "./shared";

const worker = self as unknown as { postMessage(message: unknown): void };

setInterval(() => {
  worker.postMessage("tick");
}, TICK_INTERVAL_MS);
