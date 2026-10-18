import { CFG, W, laneX } from './config';
import type { Game, Thing, Splash } from './game';

type Ctx = CanvasRenderingContext2D;

const FONT = '"Hiragino Maru Gothic ProN", "Hiragino Sans", "Noto Sans JP", sans-serif';

export const drillButton = (H: number) => ({ x: W - 54, y: H - 62, r: 36 });

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string, rot = 0): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
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

function drawFloor(ctx: Ctx, g: Game): void {
  const H = g.H;
  ctx.fillStyle = '#dff1f7';
  ctx.fillRect(0, 0, W, H);
  // スクロールするタイル目地
  const tile = 44;
  const off = g.distance % tile;
  ctx.strokeStyle = '#c3e1ec';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let y = off - tile; y < H; y += tile) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  for (let x = 0; x <= W; x += tile) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  ctx.stroke();
  // レーン
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let l = 0; l < 3; l++) ctx.fillRect(laneX(l) - 40, 0, 80, H);
  // 両サイドの壁
  ctx.fillStyle = '#9fc9d9';
  ctx.fillRect(0, 0, 18, H);
  ctx.fillRect(W - 18, 0, 18, H);
}

function drawThing(ctx: Ctx, t: Thing): void {
  const x = laneX(t.lane);
  const y = t.y;
  ellipse(ctx, x, y + 14, 24, 7, 'rgba(0,0,0,0.12)');
  switch (t.kind) {
    case 'bucket':
      roundRect(ctx, x - 22, y - 18, 44, 34, 8, '#4f86c6');
      ellipse(ctx, x, y - 18, 22, 8, '#7fb2e8');
      ellipse(ctx, x, y - 18, 16, 5, '#2f5f99');
      ctx.strokeStyle = '#2f5f99';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y - 16, 20, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      break;
    case 'soap':
      roundRect(ctx, x - 20, y - 11, 40, 22, 9, '#ff9ec7');
      roundRect(ctx, x - 14, y - 7, 28, 6, 3, '#ffd0e5');
      for (const [bx, by, br] of [[-14, -16, 5], [6, -19, 4], [16, -12, 3]]) {
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + bx, y + by, br, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    case 'towel':
      roundRect(ctx, x - 30, y - 12, 60, 24, 5, '#fff3b0');
      ctx.fillStyle = '#f4a259';
      for (let i = 0; i < 3; i++) ctx.fillRect(x - 30 + 10 + i * 17, y - 12, 6, 24);
      break;
    case 'potato':
      ellipse(ctx, x, y, 20, 11, '#8e44ad', -0.4);
      ellipse(ctx, x + 15, y - 6, 5, 4, '#f6d365', -0.4);
      ellipse(ctx, x - 15, y + 6, 4, 3, '#f6d365', -0.4);
      ellipse(ctx, x - 4, y - 3, 6, 2, 'rgba(255,255,255,0.35)', -0.4);
      break;
    case 'sasami':
      roundRect(ctx, x - 18, y - 7, 36, 14, 7, '#ffe3e3');
      ctx.strokeStyle = '#f2a7a7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = -10; i <= 10; i += 7) {
        ctx.moveTo(x + i - 3, y - 5);
        ctx.lineTo(x + i + 3, y + 5);
      }
      ctx.stroke();
      break;
  }
}

function drawSplash(ctx: Ctx, g: Game, s: Splash): void {
  if (s.warn > 0) {
    // 予告: 狙っているレーンを点滅表示
    const blink = Math.floor(s.warn * 12) % 2 === 0;
    if (!blink) return;
    ctx.fillStyle = s.wide ? 'rgba(40,140,255,0.22)' : 'rgba(40,140,255,0.18)';
    if (s.wide) ctx.fillRect(18, 0, W - 36, g.ownerY);
    else ctx.fillRect(laneX(s.lane) - 40, 0, 80, g.ownerY);
    if (s.wide) text(ctx, '大波！ ドリルで弾け！', W / 2, g.shibaY + 34, 18, '#cfe9ff');
    return;
  }
  if (s.wide) {
    const grad = ctx.createLinearGradient(0, s.y - 18, 0, s.y + 18);
    grad.addColorStop(0, 'rgba(120,200,255,0.95)');
    grad.addColorStop(1, 'rgba(40,120,230,0.85)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(18, s.y + 14);
    for (let x = 18; x <= W - 18; x += 12) ctx.lineTo(x, s.y - 10 + Math.sin(x * 0.2 + g.time * 12) * 6);
    ctx.lineTo(W - 18, s.y + 14);
    ctx.closePath();
    ctx.fill();
    return;
  }
  const x = laneX(s.lane);
  for (let i = 0; i < 4; i++) {
    const ox = Math.sin(g.time * 20 + i * 2) * 6;
    ellipse(ctx, x + ox, s.y + i * 12, 7 - i, 10 - i * 1.5, i === 0 ? '#3fa7ff' : 'rgba(63,167,255,0.6)');
  }
  ellipse(ctx, x - 2, s.y - 3, 2, 3, '#ffffff');
}

function drawShiba(ctx: Ctx, g: Game, x: number, groundY: number, z: number): void {
  ellipse(ctx, x, groundY + 10, 18 - z * 0.08, 7 - z * 0.03, 'rgba(0,0,0,0.18)');
  const y = groundY - z;
  const s = 1 + z / 160;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (g.drillT > 0) ctx.rotate(g.drillT * 40);
  if (g.slipT > 0) ctx.rotate(Math.sin(g.slipT * 30) * 0.5);
  if (g.stumbleT > 0) ctx.rotate(Math.sin(g.stumbleT * 40) * 0.2);

  // 足（走りアニメ）
  const leg = Math.sin(g.runPhase) * 5;
  const legColor = '#c8742a';
  ellipse(ctx, -10, -8 + leg, 4, 6, legColor);
  ellipse(ctx, 10, -8 - leg, 4, 6, legColor);
  ellipse(ctx, -10, 12 - leg, 4, 6, legColor);
  ellipse(ctx, 10, 12 + leg, 4, 6, legColor);
  // しっぽ（くるん）
  ellipse(ctx, 0, 22, 7, 7, '#e08a3c');
  ellipse(ctx, 0, 22, 3.5, 3.5, '#fff1dc');
  // 胴体
  ellipse(ctx, 0, 4, 13, 19, '#e8913f');
  ellipse(ctx, 0, 6, 6, 11, '#f3b06b');
  // 頭
  ellipse(ctx, 0, -18, 13, 12, '#e8913f');
  ctx.fillStyle = '#e8913f';
  ctx.beginPath();
  ctx.moveTo(-12, -22); ctx.lineTo(-9, -36); ctx.lineTo(-2, -26);
  ctx.moveTo(12, -22); ctx.lineTo(9, -36); ctx.lineTo(2, -26);
  ctx.fill();
  ctx.fillStyle = '#ffd9b0';
  ctx.beginPath();
  ctx.moveTo(-10, -24); ctx.lineTo(-8.5, -32); ctx.lineTo(-4, -26);
  ctx.moveTo(10, -24); ctx.lineTo(8.5, -32); ctx.lineTo(4, -26);
  ctx.fill();
  // 鼻先（前向きなので頭の上に少しだけ見える）
  ellipse(ctx, 0, -29, 6, 4, '#fff1dc');
  ellipse(ctx, 0, -32, 2.5, 2, '#3a2a20');

  if (g.blindT > 0) {
    roundRect(ctx, -16, -30, 32, 22, 6, '#fff3b0');
    ctx.fillStyle = '#f4a259';
    ctx.fillRect(-6, -30, 5, 22);
    ctx.fillRect(5, -30, 5, 22);
  }
  if (g.wetT > 0) {
    for (let i = 0; i < 3; i++) ellipse(ctx, -14 + i * 14, -6 + ((g.time * 60 + i * 9) % 20), 2, 3, '#3fa7ff');
  }
  ctx.restore();

  if (g.drillT > 0) {
    ctx.strokeStyle = 'rgba(80,170,255,0.7)';
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      const a = g.time * 25 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(x, y, 34, a, a + 1.2);
      ctx.stroke();
    }
  }
  if (g.boostT > 0) {
    ctx.strokeStyle = 'rgba(255,200,60,0.8)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const lx = x - 16 + i * 8;
      const ly = y + 30 + ((g.time * 400 + i * 23) % 40);
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx, ly + 16);
      ctx.stroke();
    }
  }
}

function drawOwner(ctx: Ctx, g: Game): void {
  const x = g.ownerX;
  const y = g.ownerY;
  const bob = Math.sin(g.time * 14) * 2;
  ellipse(ctx, x, y + 26, 26, 9, 'rgba(0,0,0,0.18)');
  // 腕とシャワー
  roundRect(ctx, x - 30, y - 8 + bob, 10, 26, 5, '#f2c9a0');
  roundRect(ctx, x + 18, y - 26, 10, 30, 5, '#f2c9a0');
  ctx.strokeStyle = '#8a97a6';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + 23, y - 24);
  ctx.quadraticCurveTo(x + 50, y + 10, x + 30, y + 40);
  ctx.stroke();
  ellipse(ctx, x + 23, y - 32, 9, 9, g.ownerAim > 0 ? '#ffffff' : '#c9d3dd');
  ellipse(ctx, x + 23, y - 32, 5, 5, '#8a97a6');
  // 体と頭
  ellipse(ctx, x, y + 6 + bob, 20, 18, '#ff7b54');
  ellipse(ctx, x, y - 12 + bob, 13, 13, '#5a3b2e');
  ellipse(ctx, x, y - 18 + bob, 10, 6, '#f2c9a0');
  if (g.ownerAim > 0) text(ctx, '!', x - 26, y - 34, 22, '#ffde59');
}

function drawHud(ctx: Ctx, g: Game): void {
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

  // 状態表示
  const status: string[] = [];
  if (g.boostT > 0) status.push(`おいもダッシュ ${g.boostT.toFixed(1)}`);
  if (g.slipT > 0) status.push('ツルツル…');
  if (g.wetT > 0) status.push('びしょぬれ');
  status.forEach((s, i) => text(ctx, s, W / 2, 100 + i * 20, 14, '#ffffff'));

  // ドリルボタン
  const b = drillButton(g.H);
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

function drawOverlay(ctx: Ctx, g: Game): void {
  const H = g.H;
  ctx.fillStyle = 'rgba(20,30,50,0.6)';
  ctx.fillRect(0, 0, W, H);
  if (g.scene === 'title') {
    text(ctx, 'シバラン', W / 2, H * 0.2, 48, '#ffb35c');
    text(ctx, '〜シャンプーいやや〜', W / 2, H * 0.2 + 46, 18, '#ffffff');
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
    lines.forEach((l, i) => text(ctx, l, W / 2, H * 0.36 + i * 25, 14, '#e6f2ff', 'center', false));
    if (Math.floor(performance.now() / 500) % 2 === 0) text(ctx, 'タップでスタート', W / 2, H * 0.86, 22, '#ffffff');
  } else {
    text(ctx, 'つかまった…', W / 2, H * 0.28, 36, '#9fd8ff');
    text(ctx, 'シャンプーの刑', W / 2, H * 0.28 + 42, 18, '#ffffff');
    text(ctx, `${g.score}`, W / 2, H * 0.48, 56, '#ffffff');
    text(ctx, `${g.meters} m  + ボーナス ${g.bonus}`, W / 2, H * 0.48 + 44, 14, '#cfe4ff', 'center', false);
    text(ctx, g.newBest ? 'ハイスコア更新！' : `BEST ${g.best}`, W / 2, H * 0.62, 20, '#ffe08a');
    if (g.overT > 0.8 && Math.floor(performance.now() / 500) % 2 === 0) {
      text(ctx, 'タップでリトライ', W / 2, H * 0.8, 22, '#ffffff');
    }
  }
}

export function render(ctx: Ctx, g: Game): void {
  const H = g.H;
  ctx.save();
  if (g.shake > 0) ctx.translate((Math.random() - 0.5) * 10 * g.shake * 3, (Math.random() - 0.5) * 10 * g.shake * 3);

  drawFloor(ctx, g);
  for (const t of g.things) drawThing(ctx, t);
  for (const s of g.splashes) drawSplash(ctx, g, s);
  if (g.scene !== 'title') drawOwner(ctx, g);
  drawShiba(ctx, g, g.x, g.shibaY, g.z);

  // タオルで視界が遮られる
  if (g.blindT > 0) {
    const a = Math.min(1, g.blindT / 0.3) * 0.92;
    const grad = ctx.createLinearGradient(0, 0, 0, g.shibaY);
    grad.addColorStop(0, `rgba(255,243,176,${a})`);
    grad.addColorStop(0.8, `rgba(255,243,176,${a})`);
    grad.addColorStop(1, 'rgba(255,243,176,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, g.shibaY);
  }

  // 追いつかれそうなときの赤い警告
  if (g.scene === 'playing' && g.gap < 25) {
    const a = (0.25 + 0.2 * Math.sin(g.time * 10)) * (1 - g.gap / 25);
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    grad.addColorStop(0, 'rgba(255,0,0,0)');
    grad.addColorStop(1, `rgba(255,40,40,${a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  for (const p of g.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ellipse(ctx, p.x, p.y, p.size, p.size, p.color);
  }
  ctx.globalAlpha = 1;
  for (const p of g.popups) {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    text(ctx, p.text, p.x, p.y, 18, p.color);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (g.scene === 'playing') drawHud(ctx, g);
  else drawOverlay(ctx, g);
}
