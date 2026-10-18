import { CFG, W, laneX } from './config';
import type { Game } from './game';
import { SKINS } from './progress';

type Ctx = CanvasRenderingContext2D;

const FONT = '"Hiragino Maru Gothic ProN", "Hiragino Sans", "Noto Sans JP", sans-serif';

export const drillButton = (H: number) => ({ x: W - 54, y: H - 62, r: 36 });
export const muteButton = { x: W - 34, y: 106, r: 16 };

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function text(ctx: Ctx, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center', stroke = true): void {
  ctx.font = `bold ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (stroke) {
    ctx.lineWidth = Math.max(3, size / 5);
    ctx.strokeStyle = 'rgba(30,40,60,0.85)';
    ctx.lineJoin = 'round';
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function drawHud(ctx: Ctx, g: Game, H: number): void {
  roundRect(ctx, 12, 12, W - 24, 70, 14, 'rgba(25,40,60,0.55)');
  text(ctx, `${g.score}`, 28, 36, 26, '#ffffff', 'left');
  text(ctx, `${g.meters} m`, 28, 62, 13, '#cfe4ff', 'left', false);
  text(ctx, `BEST ${g.best}`, W - 28, 36, 14, '#ffe08a', 'right', false);

  // 飼い主との距離メーター
  const bx = 150, by = 58, bw = W - 28 - bx, bh = 10;
  roundRect(ctx, bx, by, bw, bh, 5, 'rgba(255,255,255,0.25)');
  const r = Math.max(0, g.gap / CFG.gapMax);
  const danger = r < 0.25;
  roundRect(ctx, bx, by, Math.max(bh, bw * r), bh, 5, danger ? '#ff5a5f' : r < 0.5 ? '#ffb703' : '#6bd66b');
  ellipse(ctx, bx, by + bh / 2, 7, 7, '#ff7b54');
  ellipse(ctx, bx + bw * r, by + bh / 2, 7, 7, '#e8913f');
  text(ctx, '飼い主との距離', bx, by - 9, 10, '#cfe4ff', 'left', false);

  const status: string[] = [];
  if (g.boostT > 0) status.push(`おいもダッシュ ${g.boostT.toFixed(1)}`);
  if (g.slipT > 0) status.push('ツルツル…');
  if (g.wetT > 0) status.push('びしょぬれ');
  status.forEach((s, i) => text(ctx, s, W / 2, 100 + i * 20, 14, '#ffffff'));

  // ドリルボタン
  const b = drillButton(H);
  const ready = g.drillCd <= 0;
  ellipse(ctx, b.x, b.y, b.r, b.r, ready ? 'rgba(63,167,255,0.9)' : 'rgba(60,80,100,0.7)');
  if (!ready) {
    ctx.fillStyle = 'rgba(63,167,255,0.6)';
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - g.drillCd / CFG.drillCooldown));
    ctx.fill();
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.stroke();
  text(ctx, '柴', b.x, b.y - 8, 18, '#ffffff');
  text(ctx, 'ドリル', b.x, b.y + 12, 12, '#ffffff');
}

type Rect = { x: number; y: number; w: number; h: number };
type Circle = { x: number; y: number; r: number };

/** タイトル・リザルト画面のボタン配置（論理座標） */
export const menuButtons = (H: number) => ({
  prevSkin: { x: W / 2 - 128, y: H * 0.58, r: 24 } as Circle,
  nextSkin: { x: W / 2 + 128, y: H * 0.58, r: 24 } as Circle,
  unlock: { x: W / 2 - 115, y: H * 0.83, w: 230, h: 44 } as Rect,
  share: { x: W / 2 - 158, y: H * 0.83, w: 170, h: 46 } as Rect,
  toTitle: { x: W / 2 + 22, y: H * 0.83, w: 136, h: 46 } as Rect,
});

export const inRect = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const inCircle = (c: Circle, x: number, y: number) => Math.hypot(x - c.x, y - c.y) <= c.r + 8;

function button(ctx: Ctx, r: Rect, label: string, color: string, size = 17): void {
  roundRect(ctx, r.x, r.y + 3, r.w, r.h, r.h / 2, 'rgba(0,0,0,0.25)');
  roundRect(ctx, r.x, r.y, r.w, r.h, r.h / 2, color);
  text(ctx, label, r.x + r.w / 2, r.y + r.h / 2, size, '#ffffff');
}

function arrow(ctx: Ctx, c: Circle, dir: number): void {
  ellipse(ctx, c.x, c.y, c.r, c.r, 'rgba(25,40,60,0.6)');
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(c.x + dir * 9, c.y);
  ctx.lineTo(c.x - dir * 6, c.y - 10);
  ctx.lineTo(c.x - dir * 6, c.y + 10);
  ctx.fill();
}

function drawOverlay(ctx: Ctx, g: Game, H: number): void {
  // 柴が見えるよう、下に行くほど暗幕を薄くする
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(20,30,50,0.7)');
  shade.addColorStop(0.42, 'rgba(20,30,50,0.55)');
  shade.addColorStop(0.55, 'rgba(20,30,50,0.1)');
  shade.addColorStop(1, 'rgba(20,30,50,0.4)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
  const ui = menuButtons(H);
  if (g.scene === 'title') {
    text(ctx, `ささみ ×${g.save.sasami}`, 20, 28, 15, '#ffd0d8', 'left');
    text(ctx, 'シバラン', W / 2, H * 0.12, 48, '#ffb35c');
    text(ctx, '〜シャンプーいやや〜', W / 2, H * 0.12 + 44, 18, '#ffffff');
    const lines = [
      '← → スワイプ：レーン移動',
      '↑ スワイプ・タップ：ジャンプ',
      '↓ スワイプ・右下ボタン：柴ドリル',
      'さつまいもで無敵、ささみを集めて柴を解放',
    ];
    lines.forEach((l, i) => text(ctx, l, W / 2, H * 0.25 + i * 22, 14, '#ffffff'));

    // 柴えらび
    arrow(ctx, ui.prevSkin, -1);
    arrow(ctx, ui.nextSkin, 1);
    const skin = g.skin;
    if (g.isUnlocked(g.viewSkin)) {
      text(ctx, skin.name, W / 2, ui.unlock.y + ui.unlock.h / 2, 22, '#ffffff');
    } else {
      const enough = g.save.sasami >= skin.cost;
      button(ctx, ui.unlock, `${skin.name}を解放（ささみ×${skin.cost}）`, enough ? '#e8763a' : '#6b7684', 15);
    }
    if (g.titleMsgT > 0) text(ctx, g.titleMsg, W / 2, ui.unlock.y - 16, 14, '#ffe08a');
    if (Math.floor(performance.now() / 500) % 2 === 0) {
      text(ctx, g.isUnlocked(g.viewSkin) ? 'タップでスタート' : `タップで${SKINS.find((s) => s.id === g.save.skin)?.name ?? ''}でスタート`, W / 2, H * 0.94, 18, '#ffffff');
    }
  } else {
    text(ctx, 'つかまった…', W / 2, H * 0.17, 36, '#9fd8ff');
    text(ctx, 'シャンプーの刑', W / 2, H * 0.17 + 40, 18, '#ffffff');
    text(ctx, `${g.score}`, W / 2, H * 0.33, 56, '#ffffff');
    text(ctx, `${g.meters} m  + ボーナス ${g.bonus}`, W / 2, H * 0.33 + 42, 14, '#ffffff');
    text(ctx, g.newBest ? 'ハイスコア更新！' : `BEST ${g.best}`, W / 2, H * 0.47, 20, '#ffe08a');
    text(ctx, `ささみ +${g.runSasami}（所持 ${g.save.sasami}）`, W / 2, H * 0.53, 15, '#ffd0d8');
    if (g.overT > 0.8) {
      button(ctx, ui.share, '結果をシェア', '#1d9bf0');
      button(ctx, ui.toTitle, '柴をえらぶ', '#e8763a', 15);
      if (Math.floor(performance.now() / 500) % 2 === 0) text(ctx, 'タップでリトライ', W / 2, H * 0.94, 20, '#ffffff');
    }
  }
}

function drawMuteButton(ctx: Ctx, muted: boolean): void {
  const b = muteButton;
  ellipse(ctx, b.x, b.y, b.r, b.r, 'rgba(25,40,60,0.55)');
  // スピーカーの形
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(b.x - 8, b.y - 3);
  ctx.lineTo(b.x - 4, b.y - 3);
  ctx.lineTo(b.x + 1, b.y - 8);
  ctx.lineTo(b.x + 1, b.y + 8);
  ctx.lineTo(b.x - 4, b.y + 3);
  ctx.lineTo(b.x - 8, b.y + 3);
  ctx.fill();
  ctx.strokeStyle = muted ? '#ff7b7b' : '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (muted) {
    ctx.moveTo(b.x + 4, b.y - 4);
    ctx.lineTo(b.x + 10, b.y + 4);
    ctx.moveTo(b.x + 10, b.y - 4);
    ctx.lineTo(b.x + 4, b.y + 4);
  } else {
    ctx.arc(b.x + 2, b.y, 5, -0.9, 0.9);
    ctx.moveTo(b.x + 6.5, b.y - 7);
    ctx.arc(b.x + 2, b.y, 9, -0.9, 0.9);
  }
  ctx.stroke();
}

const HINTS: Record<string, string> = {
  bucket: 'バケツ：ぶつかると転ぶ！ジャンプでかわせ',
  soap: '石けん：踏むとツルッと滑る！',
  towel: 'タオル：ぶつかると前が見えない！',
  potato: '焼きいも：食べると無敵ダッシュ！',
  sasami: 'ささみ：集めると新しい柴を解放！',
  splash: 'シャワー：レーン移動か柴ドリルでよけろ',
  wave: '大波：柴ドリル（↓スワイプ）で弾け！',
};

/** 指し示す先のある説明ラベル */
function label(ctx: Ctx, s: string, x: number, y: number): void {
  ctx.font = `bold 13px ${FONT}`;
  const w = ctx.measureText(s).width + 20;
  const lx = Math.max(8, Math.min(W - 8 - w, x - w / 2));
  roundRect(ctx, lx, y - 34, w, 26, 13, 'rgba(255,255,255,0.95)');
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 9);
  ctx.lineTo(x + 6, y - 9);
  ctx.lineTo(x, y - 1);
  ctx.fill();
  text(ctx, s, lx + w / 2, y - 21, 13, '#2a3a4a', 'center', false);
}

/** 飼い主の吹き出し。柴にかぶらないよう、飼い主の頭の横（画面の空いている側）に出す */
function bubble(ctx: Ctx, s: string, x: number, y: number): void {
  ctx.font = `bold 14px ${FONT}`;
  const w = Math.min(W * 0.62, ctx.measureText(s).width + 22);
  const right = x < W / 2;
  const gap = 34;
  const lx = right ? Math.min(W - 8 - w, x + gap) : Math.max(8, x - gap - w);
  const top = y - 16;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#2a3a4a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(lx, top, w, 32, 16);
  const ex = right ? lx : lx + w;
  ctx.moveTo(ex, top + 10);
  ctx.lineTo(right ? x + 12 : x - 12, y + 4);
  ctx.lineTo(ex, top + 22);
  ctx.fill();
  ctx.stroke();
  // しっぽの付け根の線を消す
  ctx.fillRect(right ? ex : ex - 4, top + 11, 4, 10);
  ctx.save();
  ctx.beginPath();
  ctx.rect(lx + 6, top, w - 12, 32);
  ctx.clip();
  text(ctx, s, lx + w / 2, top + 16, 14, '#d23c3c', 'center', false);
  ctx.restore();
}

/** project: ゲーム座標 (x, 高さ, y) → HUD の論理座標 */
export function drawHudLayer(ctx: Ctx, g: Game, H: number, muted: boolean, project: (x: number, h: number, y: number) => { x: number; y: number }): void {
  ctx.clearRect(0, 0, W, H);

  // タオルで視界が遮られる
  if (g.blindT > 0) {
    const a = Math.min(1, g.blindT / 0.3) * 0.94;
    const bottom = H * 0.62;
    const grad = ctx.createLinearGradient(0, 0, 0, bottom);
    grad.addColorStop(0, `rgba(255,243,176,${a})`);
    grad.addColorStop(0.8, `rgba(255,243,176,${a})`);
    grad.addColorStop(1, 'rgba(255,243,176,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, bottom);
  }

  if (g.scene === 'playing' && g.gap < 25) {
    const a = (0.25 + 0.2 * Math.sin(g.time * 10)) * (1 - g.gap / 25);
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    grad.addColorStop(0, 'rgba(255,0,0,0)');
    grad.addColorStop(1, `rgba(255,40,40,${a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  if (g.splashes.some((s) => s.wide && s.warn > 0)) {
    text(ctx, '大波！ ドリルで弾け！', W / 2, H * 0.7, 20, '#cfe9ff');
  }

  if (g.scene === 'playing') {
    // 説明ラベルは重ならないよう、柴にいちばん近い1つだけ出す
    const sp = g.splashes.find((s) => s.hint && !s.done && s.y > g.shibaY - 300);
    const th = g.things.filter((t) => t.hint && !t.done && t.y < g.shibaY + 30).sort((a, b) => b.y - a.y)[0];
    if (sp) {
      const p = project(sp.wide ? W / 2 : laneX(sp.lane), 60, Math.min(sp.y, g.ownerY - 40));
      label(ctx, HINTS[sp.wide ? 'wave' : 'splash'], p.x, p.y);
    } else if (th) {
      const p = project(laneX(th.lane), 70, th.y);
      label(ctx, HINTS[th.kind], p.x, p.y);
    }
    if (g.shoutT > 0) {
      const p = project(g.ownerX, 105, g.ownerY);
      bubble(ctx, g.shout, p.x, Math.min(p.y, H - 40));
    }
    // 最初に目的をはっきり見せる
    if (g.time < 2.6) {
      ctx.globalAlpha = Math.min(1, (2.6 - g.time) * 2);
      text(ctx, '飼い主から逃げろ！', W / 2, H * 0.3, 32, '#ffb35c');
      text(ctx, 'つかまるとシャンプーの刑', W / 2, H * 0.3 + 36, 16, '#ffffff');
      ctx.globalAlpha = 1;
    }
  }

  for (const p of g.popups) {
    const pos = project(p.x, 110 + (0.9 - p.life) * 60, g.shibaY);
    ctx.globalAlpha = Math.min(1, p.life * 2);
    text(ctx, p.text, pos.x, pos.y, 18, p.color);
  }
  ctx.globalAlpha = 1;

  if (g.scene === 'playing') drawHud(ctx, g, H);
  else drawOverlay(ctx, g, H);
  drawMuteButton(ctx, muted);
}
