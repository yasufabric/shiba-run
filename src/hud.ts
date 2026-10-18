import { CFG, W } from './config';
import type { Game } from './game';

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

function drawOverlay(ctx: Ctx, g: Game, H: number): void {
  // 柴が見えるよう、下に行くほど暗幕を薄くする
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(20,30,50,0.7)');
  shade.addColorStop(0.55, 'rgba(20,30,50,0.55)');
  shade.addColorStop(0.75, 'rgba(20,30,50,0.1)');
  shade.addColorStop(1, 'rgba(20,30,50,0.35)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
  if (g.scene === 'title') {
    text(ctx, 'シバラン', W / 2, H * 0.16, 48, '#ffb35c');
    text(ctx, '〜シャンプーいやや〜', W / 2, H * 0.16 + 46, 18, '#ffffff');
    const lines = [
      '← → スワイプ：レーン移動',
      '↑ スワイプ / タップ：ジャンプ',
      '↓ スワイプ / 右下ボタン：柴ドリル',
      '',
      'バケツ：ぶつかると転ぶ',
      '石けん：踏むと滑る',
      'タオル：前が見えなくなる',
      'さつまいも：猛ダッシュ＆無敵',
      `ささみ：ボーナス +${CFG.sasamiBonus}`,
      'シャワーは柴ドリルで弾け！',
    ];
    lines.forEach((l, i) => text(ctx, l, W / 2, H * 0.28 + i * 23, 14, '#ffffff', 'center'));
    if (Math.floor(performance.now() / 500) % 2 === 0) text(ctx, 'タップでスタート', W / 2, H * 0.88, 22, '#ffffff');
  } else {
    text(ctx, 'つかまった…', W / 2, H * 0.22, 36, '#9fd8ff');
    text(ctx, 'シャンプーの刑', W / 2, H * 0.22 + 42, 18, '#ffffff');
    text(ctx, `${g.score}`, W / 2, H * 0.4, 56, '#ffffff');
    text(ctx, `${g.meters} m  + ボーナス ${g.bonus}`, W / 2, H * 0.4 + 44, 14, '#ffffff', 'center');
    text(ctx, g.newBest ? 'ハイスコア更新！' : `BEST ${g.best}`, W / 2, H * 0.54, 20, '#ffe08a');
    if (g.overT > 0.8 && Math.floor(performance.now() / 500) % 2 === 0) {
      text(ctx, 'タップでリトライ', W / 2, H * 0.86, 22, '#ffffff');
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
