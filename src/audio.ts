/** マイク入力から算出した音声レベル。volume/bass/mid/trebleは0-1に正規化される。 */
export interface AudioLevels {
  /** 全体音量 */
  volume: number;
  /** 低域 */
  bass: number;
  /** 中域 */
  mid: number;
  /** 高域 */
  treble: number;
  /** ビート検出の瞬間に1になり、時間経過で0へ指数関数的に減衰する値 */
  beatPulse: number;
  /** 検出中のBPM。直近数拍の移動平均。未検出の場合は0 */
  bpm: number;
}

/** ビート未検出とみなしBPMをリセットするまでの、最後のビートからの経過時間(ms) */
const BEAT_TIMEOUT_MS = 3000;
/** 誤検出防止のための、ビート間の最小間隔(ms)。250ms = 240BPM相当が上限 */
const MIN_BEAT_INTERVAL_MS = 250;
/** bassが直近移動平均の何倍を超えたらビートとみなすか */
const BEAT_THRESHOLD_RATIO = 1.5;
/** 無音時のノイズでの誤検出を防ぐための、bass自体の最低しきい値 */
const BEAT_MIN_BASS = 0.05;
/** beatPulseの減衰の速さ(この時定数(秒)でe^-1倍になる) */
const BEAT_PULSE_DECAY_TAU = 0.15;
/** BPM算出に使う直近ビート数 */
const BPM_HISTORY_SIZE = 8;

/** `getUserMedia` でマイク入力を取得し、周波数帯域ごとの音声レベル・ビートを算出する。 */
export class AudioAnalyzer {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private data: Uint8Array | null = null;
  private enabled = false;

  private bassAverage = 0;
  private lastBeatTime = 0;
  private beatPulse = 0;
  private bpmHistory: number[] = [];
  private bpm = 0;
  private lastSampleTime = 0;

  /** マイクの使用許可を求め、解析を開始する。 */
  async start(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.ctx = new AudioContext();
    const source = this.ctx.createMediaStreamSource(stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.8;
    source.connect(this.analyser);
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
    this.enabled = true;
  }

  /** @returns マイクの使用が既に許可され、解析中であれば true */
  isEnabled(): boolean {
    return this.enabled;
  }

  /** @returns 直近のフレームの周波数データから算出した音声レベル・ビート。未開始なら全て0。 */
  getLevels(): AudioLevels {
    if (!this.analyser || !this.data) {
      return { volume: 0, bass: 0, mid: 0, treble: 0, beatPulse: 0, bpm: 0 };
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

    const bass = bassSum / Math.max(1, bassEnd);
    const { beatPulse, bpm } = this.updateBeat(bass);

    return {
      volume: total / n,
      bass,
      mid: midSum / Math.max(1, midEnd - bassEnd),
      treble: trebleSum / Math.max(1, n - midEnd),
      beatPulse,
      bpm,
    };
  }

  /**
   * bassの急上昇からビートを検出し、beatPulseの減衰・BPMの移動平均を更新する。
   * @param bass 今フレームの低域エネルギー(0-1)
   */
  private updateBeat(bass: number): { beatPulse: number; bpm: number } {
    const now = performance.now();
    if (this.lastSampleTime === 0) this.lastSampleTime = now;
    const dtSec = (now - this.lastSampleTime) / 1000;
    this.lastSampleTime = now;

    // beatPulseは前回サンプルからの経過時間ぶん指数関数的に減衰させておく
    this.beatPulse *= Math.exp(-dtSec / BEAT_PULSE_DECAY_TAU);

    const isBeat =
      bass > BEAT_MIN_BASS &&
      bass > this.bassAverage * BEAT_THRESHOLD_RATIO &&
      now - this.lastBeatTime > MIN_BEAT_INTERVAL_MS;

    if (isBeat) {
      if (this.lastBeatTime > 0) {
        const intervalMs = now - this.lastBeatTime;
        this.bpmHistory.push(60000 / intervalMs);
        if (this.bpmHistory.length > BPM_HISTORY_SIZE) this.bpmHistory.shift();
      }
      this.lastBeatTime = now;
      this.beatPulse = 1;
    }

    if (this.lastBeatTime > 0 && now - this.lastBeatTime > BEAT_TIMEOUT_MS) {
      this.bpmHistory = [];
      this.bpm = 0;
    } else if (this.bpmHistory.length > 0) {
      this.bpm = this.bpmHistory.reduce((a, b) => a + b, 0) / this.bpmHistory.length;
    }

    // bass自体の移動平均(直近の"普段の"低域レベル)を緩やかに追従させる。
    // ビート検出のしきい値算出に使うため、ビート発生の急上昇そのものには追従しすぎないよう
    // 平滑化係数は小さめにしている。
    this.bassAverage += (bass - this.bassAverage) * 0.05;

    return { beatPulse: this.beatPulse, bpm: this.bpm };
  }
}
