/** マイク入力から算出した音声レベル。各値は0-1に正規化される。 */
export interface AudioLevels {
  /** 全体音量 */
  volume: number;
  /** 低域 */
  bass: number;
  /** 中域 */
  mid: number;
  /** 高域 */
  treble: number;
}

/** `getUserMedia` でマイク入力を取得し、周波数帯域ごとの音声レベルを算出する。 */
export class AudioAnalyzer {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private data: Uint8Array | null = null;
  private enabled = false;
  private stream: MediaStream | null = null;

  /** マイクの使用許可を求め、解析を開始する。 */
  async start(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.stream = stream;
    this.ctx = new AudioContext();
    const source = this.ctx.createMediaStreamSource(stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.8;
    source.connect(this.analyser);
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
    this.enabled = true;
  }

  /** マイクの使用を停止し、ストリーム・AudioContextを解放する。再度 `start()` すれば再開できる。 */
  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.ctx?.close();
    this.ctx = null;
    this.analyser = null;
    this.data = null;
    this.enabled = false;
  }

  /** @returns マイクの使用が既に許可され、解析中であれば true */
  isEnabled(): boolean {
    return this.enabled;
  }

  /** @returns 直近のフレームの周波数データから算出した音声レベル。未開始なら全て0。 */
  getLevels(): AudioLevels {
    if (!this.analyser || !this.data) {
      return { volume: 0, bass: 0, mid: 0, treble: 0 };
    }
    this.analyser.getByteFrequencyData(this.data as Uint8Array<ArrayBuffer>);
    const n = this.data.length;
    // 音楽・声のエネルギーは低〜中域(〜4kHz程度)に集中し、高域は倍音程度しか
    // 含まれない。境界を高域寄りに広げすぎると treble がほぼ反応しなくなるため、
    // 低域0〜6%(fftSize512・サンプリングレート44.1kHzで〜1.3kHzまで)/
    // 中域6〜25%(〜1.3〜5.5kHz)/高域25〜100%(〜5.5〜22kHz)に調整している。
    const bassEnd = Math.floor(n * 0.06);
    const midEnd = Math.floor(n * 0.25);

    let bassSum = 0, midSum = 0, trebleSum = 0, total = 0;
    for (let i = 0; i < n; i++) {
      const v = this.data[i] / 255;
      total += v;
      if (i < bassEnd) bassSum += v;
      else if (i < midEnd) midSum += v;
      else trebleSum += v;
    }

    return {
      volume: total / n,
      bass: bassSum / Math.max(1, bassEnd),
      mid: midSum / Math.max(1, midEnd - bassEnd),
      treble: trebleSum / Math.max(1, n - midEnd),
    };
  }
}
