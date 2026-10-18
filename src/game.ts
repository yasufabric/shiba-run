import { CFG, LANES, OWNER_OFFSET, OWNER_SPAN, SHIBA_Y, SPAWN_Y, W, laneX } from './config';
import type { Action } from './input';

export type ObstacleKind = 'bucket' | 'soap' | 'towel';
export type ItemKind = 'potato' | 'sasami';
export type Scene = 'title' | 'playing' | 'over';

export interface Thing {
  kind: ObstacleKind | ItemKind;
  lane: number;
  y: number;
  done: boolean;
}

export interface Splash {
  lane: number;
  y: number;
  wide: boolean; // 3レーンを覆う大波
  warn: number; // 発射前の予告時間
  done: boolean;
}

/** x, y は地面上の位置、h は高さ（いずれも px） */
export interface Particle {
  x: number; y: number; h: number; vx: number; vy: number; vh: number;
  life: number; maxLife: number; size: number; color: string;
}

export interface Popup { x: number; text: string; life: number; color: string }

/** 跳び越えるのに必要な高さ */
const CLEAR_HEIGHT: Record<ObstacleKind, number> = { bucket: 30, soap: 6, towel: 18 };
const OBSTACLES: ObstacleKind[] = ['bucket', 'soap', 'towel'];
const isObstacle = (k: Thing['kind']): k is ObstacleKind => (OBSTACLES as string[]).includes(k);

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const BEST_KEY = 'shiba-run-best';

function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

export class Game {
  scene: Scene = 'title';

  time = 0;
  distance = 0;
  bonus = 0;
  best = loadBest();
  newBest = false;

  lane = 1;
  x = laneX(1);
  z = 0;
  jumpT = -1;
  runPhase = 0;

  gap: number = CFG.gapStart;
  ownerX = laneX(1);
  ownerAim = 0; // 発射予告の演出用

  boostT = 0;
  stumbleT = 0;
  slipT = 0;
  slipDir = 0;
  blindT = 0;
  wetT = 0;
  drillT = 0;
  drillCd = 0;

  things: Thing[] = [];
  splashes: Splash[] = [];
  particles: Particle[] = [];
  popups: Popup[] = [];

  nextRow = 0;
  nextShot = 0;
  potatoCd = 0;
  overT = 0;
  shake = 0;

  get shibaY(): number { return SHIBA_Y; }
  get ownerY(): number {
    return SHIBA_Y + OWNER_OFFSET + (this.gap / CFG.gapMax) * OWNER_SPAN;
  }
  get score(): number { return Math.floor(this.distance / CFG.pxPerMeter) + this.bonus; }
  get meters(): number { return Math.floor(this.distance / CFG.pxPerMeter); }

  baseSpeed(): number {
    return Math.min(CFG.maxBaseSpeed, CFG.baseSpeed + CFG.speedRamp * this.time);
  }

  speed(): number {
    const base = this.baseSpeed();
    if (this.boostT > 0) return base * CFG.boostMult;
    let m = 1;
    if (this.stumbleT > 0) m *= CFG.stumbleMult;
    if (this.wetT > 0) m *= CFG.wetMult;
    if (this.slipT > 0) m *= 0.85;
    if (this.blindT > 0) m *= 0.85;
    return base * m;
  }

  ownerSpeed(): number {
    return this.baseSpeed() * (1 + Math.min(CFG.ownerSpeedUpMax, this.time * 0.0006));
  }

  start(): void {
    Object.assign(this, {
      scene: 'playing', time: 0, distance: 0, bonus: 0, newBest: false,
      lane: 1, x: laneX(1), z: 0, jumpT: -1, gap: CFG.gapStart, ownerX: laneX(1),
      boostT: 0, stumbleT: 0, slipT: 0, blindT: 0, wetT: 0, drillT: 0, drillCd: 0,
      things: [], splashes: [], particles: [], popups: [],
      nextRow: 200, nextShot: 3, potatoCd: 4, overT: 0, shake: 0,
    });
  }

  handle(a: Action): void {
    if (this.scene === 'title') {
      this.start();
      return;
    }
    if (this.scene === 'over') {
      if (this.overT > 0.8) this.start();
      return;
    }
    switch (a) {
      case 'left':
      case 'right':
        if (this.slipT > 0) return; // 石けんで滑っている間は操作不能
        this.lane = Math.max(0, Math.min(LANES - 1, this.lane + (a === 'left' ? -1 : 1)));
        break;
      case 'jump':
      case 'tap':
        if (this.jumpT < 0) this.jumpT = 0;
        break;
      case 'drill':
        if (this.drillCd <= 0) {
          this.drillT = CFG.drillDuration;
          this.drillCd = CFG.drillCooldown;
          this.wetT = 0; // ブルブルで水を切る
          this.burst(this.x, this.shibaY, 14, '#9fd8ff', 160);
        }
        break;
    }
  }

  update(dt: number): void {
    this.updateEffects(dt);
    if (this.scene !== 'playing') {
      this.overT += dt;
      return;
    }
    this.time += dt;
    for (const k of ['boostT', 'stumbleT', 'slipT', 'blindT', 'wetT', 'drillT', 'drillCd', 'potatoCd'] as const) {
      this[k] = Math.max(0, this[k] - dt);
    }

    // ジャンプ
    if (this.jumpT >= 0) {
      this.jumpT += dt;
      const p = this.jumpT / CFG.jumpDuration;
      if (p >= 1) {
        this.jumpT = -1;
        this.z = 0;
      } else {
        this.z = Math.sin(Math.PI * p) * CFG.jumpHeight;
      }
    }

    this.x += (laneX(this.lane) - this.x) * Math.min(1, dt * 16);
    this.ownerX += (this.x - this.ownerX) * Math.min(1, dt * 2.5);

    const v = this.speed();
    const dy = v * dt;
    this.distance += dy;
    this.runPhase += dy * 0.06;
    this.gap = Math.min(CFG.gapMax, this.gap + (v - this.ownerSpeed()) * CFG.gapRate * dt);

    // 障害物・アイテムのスクロールと出現
    for (const t of this.things) t.y += dy;
    this.nextRow -= dy;
    if (this.nextRow <= 0) {
      this.spawnRow();
      this.nextRow = Math.max(150, 270 - this.time * 1.2) + rand(0, 130);
    }

    // 飼い主のシャワー攻撃
    this.nextShot -= dt;
    if (this.nextShot <= 0) {
      this.fire();
      this.nextShot = Math.max(1.3, 3.2 - this.time * 0.02) + rand(0, 1.0);
    }
    this.ownerAim = Math.max(0, this.ownerAim - dt);
    for (const s of this.splashes) {
      if (s.warn > 0) {
        s.warn -= dt;
        s.y = this.ownerY - 20;
      } else {
        s.y -= CFG.splashSpeed * dt;
      }
    }

    this.collide();

    this.things = this.things.filter((t) => !t.done && t.y < SHIBA_Y + 200);
    this.splashes = this.splashes.filter((s) => !s.done && s.y > -60);

    if (this.gap <= 0) this.gameOver();
  }

  private spawnRow(): void {
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
    const n = Math.random() < 0.3 + Math.min(0.35, this.time * 0.005) ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      const kind: ObstacleKind = r < 0.45 ? 'bucket' : r < 0.75 ? 'soap' : 'towel';
      this.things.push({ kind, lane: lanes[i], y: SPAWN_Y, done: false });
    }
    if (Math.random() < 0.5) {
      let kind: ItemKind = 'sasami';
      if (this.potatoCd <= 0 && Math.random() < 0.35) {
        kind = 'potato';
        this.potatoCd = 6;
      }
      this.things.push({ kind, lane: lanes[n], y: SPAWN_Y, done: false });
    }
  }

  private fire(): void {
    const wide = this.time > CFG.waveStartTime && Math.random() < 0.3;
    this.splashes.push({ lane: this.lane, y: this.ownerY - 20, wide, warn: wide ? 0.8 : 0.35, done: false });
    this.ownerAim = wide ? 0.8 : 0.35;
  }

  private collide(): void {
    const sy = this.shibaY;
    for (const t of this.things) {
      if (t.done || Math.abs(t.y - sy) > 24 || Math.abs(laneX(t.lane) - this.x) > 34) continue;
      if (t.kind === 'sasami') {
        t.done = true;
        this.bonus += CFG.sasamiBonus;
        this.popup(`+${CFG.sasamiBonus}`, '#ff8fa3');
        this.burst(this.x, sy, 8, '#ffd0d8', 120);
      } else if (t.kind === 'potato') {
        t.done = true;
        this.boostT = CFG.boostDuration;
        this.stumbleT = this.wetT = this.slipT = this.blindT = 0;
        this.popup('おいも ダッシュ!', '#b35cff');
        this.burst(this.x, sy, 12, '#ffd166', 180);
      } else if (isObstacle(t.kind)) {
        if (this.z > CLEAR_HEIGHT[t.kind]) continue;
        t.done = true;
        if (this.boostT > 0) {
          this.popup('ドーン!', '#ffb703');
          this.burst(laneX(t.lane), t.y, 10, '#ffffff', 220);
          this.bonus += 20;
          continue;
        }
        this.hitObstacle(t.kind);
      }
    }

    for (const s of this.splashes) {
      if (s.done || s.warn > 0) continue;
      const inLane = s.wide || Math.abs(laneX(s.lane) - this.x) < 36;
      if (this.drillT > 0 && inLane && Math.abs(s.y - sy) < CFG.drillRadius) {
        s.done = true;
        this.popup('はじいた!', '#3fa7ff');
        this.burst(s.wide ? W / 2 : laneX(s.lane), s.y, s.wide ? 24 : 12, '#7cc8ff', 260);
        this.bonus += 30;
        continue;
      }
      if (inLane && Math.abs(s.y - sy) < 16) {
        s.done = true;
        if (this.boostT > 0) continue;
        this.wetT = CFG.wetDuration;
        this.gap -= CFG.splashPenalty;
        this.shake = 0.25;
        this.popup('ビショッ!', '#3fa7ff');
        this.burst(this.x, sy, 16, '#7cc8ff', 200);
      }
    }
  }

  private hitObstacle(kind: ObstacleKind): void {
    switch (kind) {
      case 'bucket':
        this.stumbleT = CFG.stumbleDuration;
        this.gap -= CFG.bucketPenalty;
        this.shake = 0.3;
        this.popup('ガシャン!', '#ff5a5f');
        this.burst(this.x, this.shibaY, 10, '#4f86c6', 200);
        break;
      case 'soap': {
        this.slipT = CFG.slipDuration;
        const dirs = [-1, 1].filter((d) => this.lane + d >= 0 && this.lane + d < LANES);
        this.slipDir = dirs[Math.floor(Math.random() * dirs.length)];
        this.lane += this.slipDir;
        this.popup('ツルッ!', '#ff7eb6');
        this.burst(this.x, this.shibaY, 10, '#ffffff', 140);
        break;
      }
      case 'towel':
        this.blindT = CFG.blindDuration;
        this.popup('モフッ! 前が見えない', '#c9a227');
        break;
    }
  }

  private gameOver(): void {
    this.gap = 0;
    this.scene = 'over';
    this.overT = 0;
    this.shake = 0.4;
    this.burst(this.x, this.shibaY, 30, '#9fd8ff', 260);
    if (this.score > this.best) {
      this.best = this.score;
      this.newBest = true;
      try {
        localStorage.setItem(BEST_KEY, String(this.best));
      } catch {
        // 保存できなくてもゲームは続行
      }
    }
  }

  private updateEffects(dt: number): void {
    this.shake = Math.max(0, this.shake - dt);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.h = Math.max(0, p.h + p.vh * dt);
      p.vh -= 600 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.popups) p.life -= dt;
    this.popups = this.popups.filter((p) => p.life > 0);
  }

  private popup(text: string, color: string): void {
    this.popups.push({ x: this.x, text, life: 0.9, color });
  }

  private burst(x: number, y: number, n: number, color: string, power: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(0.2, 0.7) * power;
      const life = rand(0.4, 0.8);
      this.particles.push({
        x, y, h: 20 + this.z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vh: rand(0.6, 1.4) * power,
        life, maxLife: life, size: rand(2, 5), color,
      });
    }
  }
}
