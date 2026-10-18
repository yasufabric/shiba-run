import { W } from './config';
import { Game } from './game';
import { Input } from './input';
import { drillButton, render } from './render';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const game = new Game();
let scale = 1;

function resize(): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // PCでは縦長の比率に収める
  const cssW = Math.min(vw, vh * 0.62);
  const cssH = vh;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  scale = cssW / W;
  game.H = cssH / scale;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const input = new Input(
  canvas,
  (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    return { x: (cx - r.left) / scale, y: (cy - r.top) / scale };
  },
  (x, y) => {
    if (game.scene !== 'playing') return false;
    const b = drillButton(game.H);
    return Math.hypot(x - b.x, y - b.y) < b.r + 8;
  },
);

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(1 / 30, (now - last) / 1000);
  last = now;
  while (input.queue.length) game.handle(input.queue.shift()!);
  game.update(dt);
  render(ctx, game);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 開発時のみ: デバッグ用にコンソールから参照できるようにする
if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
