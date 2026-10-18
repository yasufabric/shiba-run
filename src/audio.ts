/**
 * Web Audio API でBGMと効果音をその場で合成する（音声ファイルなし）。
 * iOS などではユーザー操作の中で unlock() を呼ぶまで音が出ない。
 */

export type Sfx =
  | 'jump' | 'drill' | 'bucket' | 'slip' | 'towel' | 'wet'
  | 'sasami' | 'potato' | 'smash' | 'deflect' | 'gameover' | 'start';

const MUTE_KEY = 'shiba-run-muted';
const MASTER_VOLUME = 0.65;
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// ---- 曲データ（ハ長調・16小節ループ。Aメロ8小節＋サビ8小節） ----

/** 和音の構成音（中音域のボイシング）とベースのルート */
const CHORDS: Record<string, { notes: number[]; root: number }> = {
  C: { notes: [60, 64, 67], root: 36 },
  Am: { notes: [57, 60, 64], root: 45 },
  F: { notes: [57, 60, 65], root: 41 },
  G: { notes: [55, 59, 62], root: 43 },
  Dm: { notes: [57, 62, 65], root: 38 },
  Em: { notes: [55, 59, 64], root: 40 },
  E7: { notes: [56, 59, 62], root: 40 },
  G7: { notes: [55, 59, 65], root: 43 },
};

/** 小節ごとのコード（2つあるときは前半・後半） */
const PROGRESSION: string[][] = [
  ['C'], ['Am'], ['F'], ['G'], ['C'], ['Am'], ['Dm', 'G'], ['C'],
  ['F'], ['G'], ['Em'], ['Am'], ['Dm'], ['G'], ['E7'], ['G7'],
];

/** メロディ: 小節ごとに [音, 8分音符いくつ分] の並び（null は休符） */
const MELODY_BARS: [number | null, number][][] = [
  [[76, 1], [79, 1], [84, 2], [83, 1], [79, 1], [76, 2]],
  [[81, 2], [79, 1], [76, 1], [72, 2], [74, 2]],
  [[77, 1], [81, 1], [84, 2], [81, 1], [77, 1], [81, 2]],
  [[79, 3], [77, 1], [76, 1], [74, 1], [71, 2]],
  [[76, 1], [79, 1], [84, 2], [83, 1], [79, 1], [76, 2]],
  [[81, 2], [84, 1], [83, 1], [81, 2], [76, 2]],
  [[77, 2], [81, 2], [79, 2], [83, 2]],
  [[84, 4], [null, 4]],
  [[81, 1], [84, 1], [81, 1], [77, 1], [79, 2], [81, 2]],
  [[83, 1], [86, 1], [83, 1], [79, 1], [81, 2], [83, 2]],
  [[79, 1], [83, 1], [79, 1], [76, 1], [76, 2], [79, 2]],
  [[81, 3], [79, 1], [76, 2], [72, 2]],
  [[74, 1], [77, 1], [81, 2], [77, 1], [81, 1], [86, 2]],
  [[83, 2], [81, 1], [79, 1], [77, 2], [74, 2]],
  [[76, 1], [80, 1], [83, 2], [86, 2], [83, 2]],
  [[79, 2], [77, 1], [76, 1], [74, 2], [71, 2]],
];

const STEPS_PER_BAR = 8;
const TOTAL_STEPS = PROGRESSION.length * STEPS_PER_BAR;

/** ステップ番号 → そこで鳴り始めるメロディの音と長さ */
const MELODY = new Map<number, { note: number; len: number }>();
MELODY_BARS.forEach((bar, b) => {
  let pos = b * STEPS_PER_BAR;
  for (const [note, len] of bar) {
    if (note !== null) MELODY.set(pos, { note, len });
    pos += len;
  }
});

const chordAt = (step: number) => {
  const bar = PROGRESSION[Math.floor(step / STEPS_PER_BAR)];
  const half = (step % STEPS_PER_BAR) < 4 ? 0 : 1;
  return CHORDS[bar[Math.min(half, bar.length - 1)]];
};

// ---- 音源 ----

/**
 * 楽器と効果音の合成エンジン。AudioContext でも OfflineAudioContext でも動く。
 * 出力: 各楽器 → (dry / reverb / delay) → master → compressor → destination
 */
class Engine {
  readonly master: GainNode;
  private bgm: GainNode;
  private sfxBus: GainNode;
  private reverbSend: GainNode;
  private delaySend: GainNode;
  private noise: AudioBuffer;

  constructor(private ctx: BaseAudioContext, muted: boolean) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    comp.attack.value = 0.005;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.gain.value = muted ? 0 : MASTER_VOLUME;
    this.master.connect(comp);

    this.bgm = ctx.createGain();
    this.bgm.gain.value = 0.9;
    this.bgm.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.8;
    this.sfxBus.connect(this.master);

    // お風呂場っぽい残響（ノイズを減衰させたインパルス応答）
    const reverb = ctx.createConvolver();
    reverb.buffer = this.impulse(1.8);
    const reverbOut = ctx.createGain();
    reverbOut.gain.value = 0.5;
    reverb.connect(reverbOut).connect(this.master);
    this.reverbSend = ctx.createGain();
    this.reverbSend.connect(reverb);

    // メロディ用のやまびこ（フィードバック付きディレイ）
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.32;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2500;
    delay.connect(tone).connect(fb).connect(delay);
    const delayOut = ctx.createGain();
    delayOut.gain.value = 0.35;
    tone.connect(delayOut).connect(this.master);
    this.delaySend = ctx.createGain();
    this.delaySend.connect(delay);

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  private impulse(seconds: number): AudioBuffer {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  /** 左右の定位をつけて出力先へつなぐ（StereoPanner 非対応環境ではそのまま） */
  private route(node: AudioNode, dest: AudioNode, pan = 0, reverb = 0, delay = 0): void {
    let out: AudioNode = node;
    if (pan !== 0 && 'createStereoPanner' in this.ctx) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      node.connect(p);
      out = p;
    }
    out.connect(dest);
    if (reverb > 0) {
      const g = this.ctx.createGain();
      g.gain.value = reverb;
      out.connect(g).connect(this.reverbSend);
    }
    if (delay > 0) {
      const g = this.ctx.createGain();
      g.gain.value = delay;
      out.connect(g).connect(this.delaySend);
    }
  }

  private osc(type: OscillatorType, freq: number, t: number, dur: number, dest: AudioNode, detune = 0): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.detune.value = detune;
    o.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  /** 減衰する音量エンベロープ */
  private env(t: number, peak: number, attack: number, decay: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }

  private noiseHit(t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, q: number, dest: AudioNode): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.env(t, vol, 0.002, dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  // ---- BGMの楽器 ----

  /** マリンバ風のメロディ（基音＋高い倍音がすぐ消える） */
  private mallet(note: number, t: number, len: number): void {
    const f = midi(note);
    const out = this.ctx.createGain();
    this.route(out, this.bgm, 0, 0.25, 0.25);
    const body = this.env(t, 0.22, 0.004, Math.max(0.35, len * 0.9));
    body.connect(out);
    this.osc('sine', f, t, len + 0.4, body);
    this.osc('triangle', f, t, len + 0.4, this.connectGain(body, 0.35), 4);
    const ping = this.env(t, 0.08, 0.002, 0.08);
    ping.connect(out);
    this.osc('sine', f * 4, t, 0.12, ping);
  }

  private connectGain(dest: AudioNode, v: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = v;
    g.connect(dest);
    return g;
  }

  /** 裏拍で弾むウクレレ風のコードカッティング */
  private strum(notes: number[], t: number): void {
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2600, t);
    lp.frequency.exponentialRampToValueAtTime(700, t + 0.15);
    this.route(lp, this.bgm, -0.25, 0.2);
    notes.forEach((n, i) => {
      const s = t + i * 0.012; // ジャラッと少しずらす
      const g = this.env(s, 0.05, 0.003, 0.17);
      g.connect(lp);
      this.osc('sawtooth', midi(n), s, 0.2, g, -6);
      this.osc('triangle', midi(n + 12), s, 0.2, g, 5);
    });
  }

  /** サビで後ろに薄く敷くパッド */
  private pad(notes: number[], t: number, dur: number): void {
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    this.route(lp, this.bgm, 0.2, 0.4);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.025, t + 0.25);
    g.gain.setValueAtTime(0.025, t + dur - 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
    g.connect(lp);
    for (const n of notes) {
      this.osc('sawtooth', midi(n), t, dur + 0.25, g, -8);
      this.osc('sawtooth', midi(n), t, dur + 0.25, g, 8);
    }
  }

  /** フィルターで弾むベース＋サブの正弦波 */
  private bass(note: number, t: number, dur: number): void {
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 5;
    lp.frequency.setValueAtTime(1400, t);
    lp.frequency.exponentialRampToValueAtTime(260, t + 0.12);
    this.route(lp, this.bgm);
    const g = this.env(t, 0.16, 0.004, dur);
    g.connect(lp);
    this.osc('sawtooth', midi(note), t, dur, g);
    const sub = this.env(t, 0.3, 0.004, dur);
    this.route(sub, this.bgm);
    this.osc('sine', midi(note), t, dur, sub);
  }

  private kick(t: number): void {
    const g = this.env(t, 0.9, 0.002, 0.25);
    this.route(g, this.bgm);
    const o = this.osc('sine', 150, t, 0.3, g);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    this.noiseHit(t, 0.015, 0.15, 'highpass', 3000, 0.7, this.bgm);
  }

  private snare(t: number): void {
    const out = this.ctx.createGain();
    this.route(out, this.bgm, 0.05, 0.35);
    this.noiseHit(t, 0.16, 0.32, 'bandpass', 1900, 0.8, out);
    const g = this.env(t, 0.22, 0.002, 0.09);
    g.connect(out);
    const o = this.osc('triangle', 200, t, 0.12, g);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
  }

  private hat(t: number, open: boolean, accent: boolean): void {
    const out = this.ctx.createGain();
    this.route(out, this.bgm, 0.3, 0.05);
    this.noiseHit(t, open ? 0.18 : 0.035, accent ? 0.11 : 0.06, 'highpass', 8000, 0.7, out);
  }

  /** BGMの1ステップ（8分音符）ぶんを時刻 t に予約する */
  playStep(step: number, t: number, eighth: number): void {
    const inBar = step % STEPS_PER_BAR;
    const chorus = step >= TOTAL_STEPS / 2;
    const chord = chordAt(step);

    const mel = MELODY.get(step);
    if (mel) this.mallet(mel.note, t, mel.len * eighth);

    // ベース: ルート・オクターブ・5度で跳ねる
    const pattern = [0, null, 12, 7, 0, null, 12, 7];
    const interval = pattern[inBar];
    if (interval !== null) this.bass(chord.root + interval, t, eighth * 0.85);

    if (inBar % 2 === 1) this.strum(chord.notes, t);
    if (chorus && inBar % 4 === 0) this.pad(chord.notes.map((n) => n + 12), t, eighth * 4);

    if (inBar === 0 || inBar === 4 || (chorus && inBar === 5)) this.kick(t);
    if (inBar === 2 || inBar === 6) this.snare(t);
    this.hat(t, inBar === 7, inBar % 2 === 1);
    // 小節の終わりにスネアのおかず（4小節ごと）
    if (inBar === 7 && Math.floor(step / STEPS_PER_BAR) % 4 === 3) this.snare(t + eighth / 2);
  }

  // ---- 効果音 ----

  private blip(type: OscillatorType, freq: number, t: number, dur: number, vol: number, freqEnd?: number): void {
    const g = this.env(t, vol, 0.004, dur);
    this.route(g, this.sfxBus, 0, 0.15);
    const o = this.osc(type, freq, t, dur, g);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  }

  sfx(name: Sfx, t: number): void {
    const bus = this.sfxBus;
    switch (name) {
      case 'jump':
        this.blip('triangle', 420, t, 0.16, 0.3, 900);
        this.blip('sine', 840, t, 0.12, 0.12, 1600);
        break;
      case 'drill':
        this.noiseHit(t, 0.4, 0.35, 'bandpass', 1400, 1.5, bus);
        this.blip('triangle', 300, t, 0.4, 0.25, 1100);
        break;
      case 'bucket':
        this.blip('square', 220, t, 0.25, 0.18, 70);
        this.noiseHit(t, 0.2, 0.3, 'highpass', 2500, 0.7, bus);
        this.blip('triangle', 1200, t, 0.3, 0.12, 1150); // カーンという金属音
        break;
      case 'slip':
        this.blip('sine', 300, t, 0.15, 0.3, 1300);
        this.blip('sine', 1300, t + 0.15, 0.22, 0.25, 350);
        break;
      case 'towel':
        this.noiseHit(t, 0.3, 0.3, 'lowpass', 700, 0.7, bus);
        break;
      case 'wet':
        this.noiseHit(t, 0.45, 0.4, 'lowpass', 1600, 0.7, bus);
        this.blip('sine', 900, t, 0.22, 0.18, 280);
        break;
      case 'sasami':
        this.mallet(84, t, 0.1);
        this.mallet(91, t + 0.08, 0.2);
        break;
      case 'potato':
        [72, 76, 79, 84, 88].forEach((n, i) => this.mallet(n, t + i * 0.06, 0.15));
        break;
      case 'smash':
        this.noiseHit(t, 0.22, 0.35, 'highpass', 1800, 0.7, bus);
        this.blip('square', 500, t, 0.12, 0.12, 1000);
        break;
      case 'deflect':
        this.mallet(88, t, 0.1);
        this.mallet(95, t + 0.06, 0.25);
        break;
      case 'start':
        [72, 79, 84].forEach((n, i) => this.mallet(n, t + i * 0.08, 0.2));
        break;
      case 'gameover':
        [79, 75, 72, 67].forEach((n, i) => this.mallet(n, t + i * 0.2, 0.3));
        this.noiseHit(t, 0.9, 0.25, 'lowpass', 1200, 0.7, bus);
        break;
    }
  }
}

/** 開発用: BGMをオフラインで書き出す（音量チェックや試聴ファイル作成に使う） */
export async function renderBgm(seconds: number, tempo = 132): Promise<AudioBuffer> {
  const sr = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr);
  const engine = new Engine(ctx, false);
  const eighth = 60 / tempo / 2;
  for (let step = 0, t = 0.05; t < seconds - 0.5; step++, t += eighth) {
    engine.playStep(step % TOTAL_STEPS, t, eighth);
  }
  return ctx.startRendering();
}

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export class Sound {
  muted = loadMuted();
  /** BGMのテンポ（BPM）。ゲーム側から速度に合わせて上げる */
  tempo = 132;
  private ctx: AudioContext | null = null;
  private engine: Engine | null = null;
  private bgmOn = false;
  private step = 0;
  private nextTime = 0;
  private timer: number | undefined;

  /** ユーザー操作のイベントハンドラ内で呼ぶ */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.engine = new Engine(this.ctx, this.muted);
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
    if (this.ctx && this.engine) {
      this.engine.master.gain.setTargetAtTime(this.muted ? 0 : MASTER_VOLUME, this.ctx.currentTime, 0.02);
    }
  }

  startBgm(): void {
    if (!this.ctx || this.bgmOn) return;
    this.bgmOn = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stopBgm(): void {
    if (!this.bgmOn) return;
    this.bgmOn = false;
    window.clearInterval(this.timer);
  }

  /** 先読みして少し先までの音符を予約する */
  private schedule(): void {
    const ctx = this.ctx!;
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05; // タブ復帰時など
    while (this.nextTime < ctx.currentTime + 0.12) {
      const eighth = 60 / this.tempo / 2;
      this.engine!.playStep(this.step, this.nextTime, eighth);
      this.nextTime += eighth;
      this.step = (this.step + 1) % TOTAL_STEPS;
    }
  }

  play(name: Sfx): void {
    if (!this.ctx || !this.engine || this.muted) return;
    this.engine.sfx(name, this.ctx.currentTime);
  }
}
