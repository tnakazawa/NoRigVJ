// バックグラウンドタブ/occludedウィンドウでもタイマーがスロットルされないよう、
// 音声解析・状態送信を駆動するtickだけをWorker側で刻む。
const INTERVAL_MS = 33; // 約30fps相当

const worker = self as unknown as { postMessage(message: unknown): void };

setInterval(() => {
  worker.postMessage("tick");
}, INTERVAL_MS);
