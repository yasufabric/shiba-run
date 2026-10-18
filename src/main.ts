import { W } from './config';
import { Game } from './game';
import { Sound } from './audio';
import { drawHudLayer, drillButton, inCircle, inRect, menuButtons, muteButton } from './hud';
import { Input } from './input';
import { World } from './world';

const stage = document.getElementById('stage') as HTMLDivElement;
const glCanvas = document.getElementById('world') as HTMLCanvasElement;
const hudCanvas = document.getElementById('hud') as HTMLCanvasElement;
const hud = hudCanvas.getContext('2d')!;
const game = new Game();
const world = new World(glCanvas);
const sound = new Sound();
let scale = 1;
let H = 640;

function resize(): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // PCでは縦長の比率に収める
  const cssW = Math.min(vw, vh * 0.62);
  const cssH = vh;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  scale = cssW / W;
  H = cssH / scale;
  stage.style.width = `${cssW}px`;
  stage.style.height = `${cssH}px`;
  hudCanvas.width = Math.round(cssW * dpr);
  hudCanvas.height = Math.round(cssH * dpr);
  hud.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  world.resize(cssW, cssH, dpr);
}
window.addEventListener('resize', resize);
resize();

const input = new Input(
  hudCanvas,
  (cx, cy) => {
    const r = hudCanvas.getBoundingClientRect();
    return { x: (cx - r.left) / scale, y: (cy - r.top) / scale };
  },
  (x, y) => {
    if (Math.hypot(x - muteButton.x, y - muteButton.y) < muteButton.r + 10) return 'mute';
    const ui = menuButtons(H);
    if (game.scene === 'title') {
      if (inCircle(ui.prevSkin, x, y)) return 'prevSkin';
      if (inCircle(ui.nextSkin, x, y)) return 'nextSkin';
      if (!game.isUnlocked(game.viewSkin) && inRect(ui.unlock, x, y)) return 'unlock';
    }
    if (game.scene === 'over' && game.overT > 0.8) {
      if (inRect(ui.share, x, y)) return 'share';
      if (inRect(ui.toTitle, x, y)) return 'toTitle';
    }
    const b = drillButton(H);
    if (game.scene === 'playing' && Math.hypot(x - b.x, y - b.y) < b.r + 8) return 'drill';
    return null;
  },
);

// ---- 結果のシェア ----
const SITE_URL = 'https://yasufabric.github.io/shiba-run/';
/** リザルト画面のスクリーンショット（シェア画像に使う） */
let shareImage: File | null = null;
let snapshotTaken = false;

/** 描画直後のキャンバスを1枚の画像にまとめておく（WebGLは描画直後でないと読めない） */
function takeSnapshot(): void {
  const c = document.createElement('canvas');
  c.width = hudCanvas.width;
  c.height = hudCanvas.height;
  const g = c.getContext('2d')!;
  g.drawImage(glCanvas, 0, 0, c.width, c.height);
  g.drawImage(hudCanvas, 0, 0);
  c.toBlob((blob) => {
    if (blob) shareImage = new File([blob], 'shiba-run.png', { type: 'image/png' });
  }, 'image/png');
}

/** タップ中に呼ぶ（共有シートはユーザー操作の中でしか開けない） */
function shareResult(): void {
  const text = `お風呂から${game.meters}m逃げたけど、つかまってシャンプーされた… スコア${game.score} #シバラン`;
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const withImage: ShareData = { text, url: SITE_URL, files: shareImage ? [shareImage] : [] };
  if (nav.share) {
    const data = shareImage && nav.canShare?.(withImage) ? withImage : { text, url: SITE_URL };
    nav.share(data).catch(() => {
      // キャンセルされたときなどは何もしない
    });
    return;
  }
  // 共有シートがないPCなどは X の投稿画面を開く
  const intent = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SITE_URL)}`;
  window.open(intent, '_blank', 'noopener');
}

hudCanvas.addEventListener('pointerdown', (e) => {
  if (game.scene !== 'over' || game.overT <= 0.8) return;
  const r = hudCanvas.getBoundingClientRect();
  if (inRect(menuButtons(H).share, (e.clientX - r.left) / scale, (e.clientY - r.top) / scale)) shareResult();
});

// ブラウザの制約で、音はユーザー操作のイベント内でしか鳴らし始められない
const unlockAudio = () => {
  sound.unlock();
  if (game.scene !== 'over') sound.startBgm();
};
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

const toHud = (x: number, h: number, y: number) => {
  const p = world.project(x, h, y);
  return { x: p.x / scale, y: p.y / scale };
};

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(1 / 30, (now - last) / 1000);
  last = now;
  while (input.queue.length) {
    const a = input.queue.shift()!;
    if (a === 'mute') sound.toggleMute();
    else game.handle(a);
  }
  const wasPlaying = game.scene === 'playing';
  game.update(dt);
  for (const s of game.sounds) sound.play(s);
  game.sounds.length = 0;
  if (game.scene === 'playing') {
    if (!wasPlaying) sound.startBgm();
    sound.tempo = 132 + Math.min(32, game.time * 0.3); // 走るほど曲も速くなる
  } else if (game.scene === 'over') {
    sound.stopBgm();
  }
  world.render(game);
  drawHudLayer(hud, game, H, sound.muted, toHud);
  if (game.scene === 'over') {
    // ボタンが出る直前の結果画面を撮っておく
    if (!snapshotTaken && game.overT > 0.6) {
      snapshotTaken = true;
      takeSnapshot();
    }
  } else {
    snapshotTaken = false;
    shareImage = null;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 開発時のみ: デバッグ用にコンソールから参照できるようにする
if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
