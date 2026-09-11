export interface AudioLevels {
  volume: number;    // 0-1 全体音量
  bass: number;      // 0-1 低域
  mid: number;       // 0-1 中域
  treble: number;    // 0-1 高域
}

export class AudioAnalyzer {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private data: Uint8Array | null = null;
  private enabled = false;

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

  isEnabled(): boolean {
    return this.enabled;
  }

  getLevels(): AudioLevels {
    if (!this.analyser || !this.data) {
      return { volume: 0, bass: 0, mid: 0, treble: 0 };
    }
    this.analyser.getByteFrequencyData(this.data as Uint8Array<ArrayBuffer>);
    const n = this.data.length;
    const bassEnd = Math.floor(n * 0.1);
    const midEnd = Math.floor(n * 0.5);

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
