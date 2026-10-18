/**
 * Web Audio API でBGMと効果音をその場で合成する（音声ファイルなし）。
 * iOS などではユーザー操作の中で unlock() を呼ぶまで音が出ない。
 */

export type Sfx =
  | 'jump' | 'drill' | 'bucket' | 'slip' | 'towel' | 'wet'
  | 'sasami' | 'potato' | 'smash' | 'deflect' | 'gameover' | 'start';

const MUTE_KEY = 'shiba-run-muted';
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const _ = null;

// 8分音符 × 8小節のメロディ（MIDIノート番号、null は休符）
const MELODY: (number | null)[] = [
  76, 79, 81, 79, 76, _, 72, 74,
  76, 76, 74, 72, 74, _, _, _,
  76, 79, 81, 79, 76, _, 72, 74,
  76, 74, 72, 74, 72, _, _, _,
  77, 77, 81, 77, 76, 76, 79, 76,
  74, 74, 77, 74, 72, _, 67, _,
  69, 72, 74, 76, 79, 76, 74, 72,
  74, _, 76, _, 72, _, _, _,
];
// 小節ごとのベースのルート音
const BASS_ROOTS = [48, 48, 48, 43, 41, 43, 45, 48];

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export class Sound {
  muted = loadMuted();
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private bgmBus!: GainNode;
  private noise!: AudioBuffer;
  private bgmOn = false;
  private step = 0;
  private nextTime = 0;
  private timer: number | undefined;
  /** BGMのテンポ（BPM）。ゲーム側から速度に合わせて上げる */
  tempo = 140;

  /** ユーザー操作のイベントハンドラ内で呼ぶ */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
      this.bgmBus = this.ctx.createGain();
      this.bgmBus.gain.value = 0.45;
      this.bgmBus.connect(this.master);
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // 保存できなくても切り替え自体は効く
    }
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.6, this.ctx.currentTime, 0.02);
  }

  startBgm(): void {
    if (!this.ctx || this.bgmOn) return;
    this.bgmOn = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.bgmBus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.bgmBus.gain.setValueAtTime(0.45, this.ctx.currentTime);
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stopBgm(): void {
    if (!this.ctx || !this.bgmOn) return;
    this.bgmOn = false;
    window.clearInterval(this.timer);
    // 予約済みの音は短くフェードアウトさせる
    const t = this.ctx.currentTime;
    this.bgmBus.gain.setTargetAtTime(0, t, 0.05);
  }

  /** 先読みして少し先までの音符を予約する */
  private schedule(): void {
    const ctx = this.ctx!;
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05; // タブ復帰時など
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += 60 / this.tempo / 2; // 8分音符
      this.step = (this.step + 1) % MELODY.length;
    }
  }

  private playStep(step: number, t: number): void {
    const eighth = 60 / this.tempo / 2;
    const note = MELODY[step];
    if (note !== null) this.tone('square', midi(note), t, eighth * 0.9, 0.12, this.bgmBus);
    const root = BASS_ROOTS[Math.floor(step / 8)];
    this.tone('triangle', midi(root + (step % 2 === 0 ? 0 : 12)), t, eighth * 0.8, 0.35, this.bgmBus);
    if (step % 4 === 0) this.kick(t);
    if (step % 2 === 1) this.hat(t);
  }

  private tone(type: OscillatorType, freq: number, t: number, dur: number, vol: number, dest: AudioNode = this.master, freqEnd?: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noiseBurst(t: number, dur: number, vol: number, filterFreq: number, type: BiquadFilterType = 'highpass', dest: AudioNode = this.master): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private kick(t: number): void {
    this.tone('sine', 150, t, 0.12, 0.5, this.bgmBus, 45);
  }

  private hat(t: number): void {
    this.noiseBurst(t, 0.04, 0.12, 7000, 'highpass', this.bgmBus);
  }

  play(name: Sfx): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'jump':
        this.tone('square', 420, t, 0.14, 0.15, this.master, 840);
        break;
      case 'drill':
        this.noiseBurst(t, 0.35, 0.3, 1200, 'bandpass');
        this.tone('triangle', 300, t, 0.35, 0.25, this.master, 900);
        break;
      case 'bucket':
        this.tone('square', 180, t, 0.25, 0.25, this.master, 60);
        this.noiseBurst(t, 0.15, 0.25, 3000);
        break;
      case 'slip':
        this.tone('sine', 300, t, 0.15, 0.3, this.master, 1200);
        this.tone('sine', 1200, t + 0.15, 0.2, 0.25, this.master, 400);
        break;
      case 'towel':
        this.noiseBurst(t, 0.25, 0.25, 600, 'lowpass');
        break;
      case 'wet':
        this.noiseBurst(t, 0.4, 0.35, 1500, 'lowpass');
        this.tone('sine', 900, t, 0.2, 0.15, this.master, 300);
        break;
      case 'sasami':
        this.tone('square', midi(84), t, 0.07, 0.12);
        this.tone('square', midi(91), t + 0.07, 0.12, 0.12);
        break;
      case 'potato':
        [72, 76, 79, 84, 88].forEach((n, i) => this.tone('square', midi(n), t + i * 0.06, 0.1, 0.12));
        break;
      case 'smash':
        this.noiseBurst(t, 0.2, 0.3, 2000);
        this.tone('square', 500, t, 0.1, 0.15, this.master, 1000);
        break;
      case 'deflect':
        this.tone('triangle', midi(88), t, 0.08, 0.25);
        this.tone('triangle', midi(95), t + 0.06, 0.15, 0.2);
        break;
      case 'start':
        [72, 79, 84].forEach((n, i) => this.tone('square', midi(n), t + i * 0.08, 0.12, 0.12));
        break;
      case 'gameover':
        [79, 75, 72, 67].forEach((n, i) => this.tone('square', midi(n), t + i * 0.18, 0.22, 0.15));
        this.noiseBurst(t, 0.8, 0.2, 1200, 'lowpass');
        break;
    }
  }
}
