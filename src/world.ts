import * as THREE from 'three';
import { SHIBA_Y, W, laneX } from './config';
import type { Game, Particle, Splash, Thing } from './game';

/** ゲーム座標 (px) → three.js のワールド座標への換算係数 */
const U = 1.9 / 96;
const wx = (x: number) => (x - W / 2) * U;
const wz = (y: number) => (y - SHIBA_Y) * U;

const BG = 0xcfeaf4;
const TILE = 0.95;
const FLOOR_W = 6.2;
const FLOOR_L = 80;
const MAX_PARTICLES = 400;
/** カメラを少し右に振って柴を斜め後ろから見る（真後ろだと犬の形がわかりにくい） */
const CAM_SIDE = 0.9;
/** 柴の表示倍率（当たり判定はゲームロジック側なので見た目だけ） */
const SHIBA_SCALE = 1.35;

const mat = (color: THREE.ColorRepresentation, extra: THREE.MeshToonMaterialParameters = {}) =>
  new THREE.MeshToonMaterial({ color, ...extra });

function mesh(geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  return m;
}

function tileTexture(base: string, line: string, rx: number, ry: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = line;
  g.fillRect(0, 0, 128, 6);
  g.fillRect(0, 0, 6, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** 唐草模様（緑地に白い渦巻きのつる） */
function karakusaTexture(): THREE.CanvasTexture {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1f7a4c';
  g.fillRect(0, 0, size, size);
  g.strokeStyle = '#f4f1e1';
  g.lineWidth = 5;
  g.lineCap = 'round';
  const curl = (cx: number, cy: number, r: number, dir: number) => {
    g.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = dir * i * 0.3;
      const rr = r * (1 - i / 44);
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  };
  // タイルの端でつながるように、つるの波線と渦巻きを2つずつ置く
  g.beginPath();
  for (let x = 0; x <= size; x += 4) g.lineTo(x, size / 2 + Math.sin((x / size) * Math.PI * 2) * 22);
  g.stroke();
  curl(size * 0.25, size * 0.25, 20, 1);
  curl(size * 0.75, size * 0.75, 20, -1);
  curl(size * 0.75, size * 0.18, 12, -1);
  curl(size * 0.25, size * 0.82, 12, 1);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function stripeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff3b0';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#f4a259';
  for (let i = 0; i < 3; i++) g.fillRect(8 + i * 20, 0, 8, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function blobShadow(r: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.01;
  return m;
}

interface ShibaParts {
  root: THREE.Group;
  spin: THREE.Group;
  /** 前足2本・後ろ足2本（付け根が回転軸） */
  legs: THREE.Group[];
  head: THREE.Group;
  ears: THREE.Group[];
  tail: THREE.Group;
  eyes: THREE.Mesh[];
  shadow: THREE.Mesh;
  towel: THREE.Mesh;
  ring: THREE.Mesh;
  furMats: THREE.MeshToonMaterial[];
}

const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x4a2a14, side: THREE.BackSide });

/** 裏面だけを少し大きく描いて、トゥーン調の輪郭線をつける */
function outline(m: THREE.Mesh, thickness = 1.07): THREE.Mesh {
  const o = new THREE.Mesh(m.geometry, OUTLINE);
  o.scale.setScalar(thickness);
  m.add(o);
  return m;
}

function buildShiba(): ShibaParts {
  const root = new THREE.Group();
  root.scale.setScalar(SHIBA_SCALE);
  const spin = new THREE.Group();
  root.add(spin);
  const fur = mat(0xdc8433); // 赤柴
  const furDark = mat(0xc06d25);
  const cream = mat(0xfff4e2); // 裏白
  const black = mat(0x231815);
  const pink = mat(0xf2a7a0);
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });

  // 胴体: 横長のカプセルで背中のラインを作る（上から見て犬らしい長さが出るように）
  const body = outline(mesh(new THREE.CapsuleGeometry(0.24, 0.5, 8, 18).rotateX(Math.PI / 2), fur, 0, 0.56, 0.04));
  body.scale.set(1.05, 0.95, 1);
  // 肩まわり（胴から首へのつなぎ）
  const shoulder = mesh(new THREE.SphereGeometry(0.25, 18, 14), fur, 0, 0.62, -0.3);
  // 裏白（胸・お腹・お尻）
  const chest = mesh(new THREE.SphereGeometry(0.17, 16, 12), cream, 0, 0.55, -0.47);
  chest.scale.set(0.9, 1.05, 0.6);
  const belly = mesh(new THREE.SphereGeometry(0.2, 16, 10), cream, 0, 0.41, 0.02);
  belly.scale.set(0.9, 0.55, 1.7);
  const rump = mesh(new THREE.SphereGeometry(0.13, 14, 10), cream, 0, 0.5, 0.53);
  rump.scale.set(1, 1.05, 0.4);
  // 首: 前に傾いたカプセルで肩から頭へなだらかにつなぐ
  const neck = mesh(new THREE.CapsuleGeometry(0.19, 0.18, 6, 14), fur, 0, 0.72, -0.52);
  neck.rotation.x = -1.0;
  for (const sx of [-1, 1]) {
    const haunch = outline(mesh(new THREE.SphereGeometry(0.16, 14, 10), fur, sx * 0.15, 0.5, 0.33), 1.06);
    haunch.scale.set(0.9, 1.1, 1.2);
    // 太ももの後ろ側の白い毛
    const pants = mesh(new THREE.SphereGeometry(0.11, 12, 10), cream, sx * 0.12, 0.43, 0.47);
    pants.scale.set(0.9, 1.1, 0.6);
    spin.add(haunch, pants);
  }
  spin.add(body, shoulder, chest, belly, rump, neck);

  // 首に巻いた唐草模様の風呂敷（後ろに結び目、前に三角が垂れる）
  const kTex = karakusaTexture();
  kTex.repeat.set(6, 1);
  const scarfMat = mat(0xffffff, { map: kTex });
  const band = outline(mesh(new THREE.TorusGeometry(0.21, 0.055, 10, 32), scarfMat, 0, 0.75, -0.56), 1.08);
  band.rotation.x = 0.57;
  const knotTex = karakusaTexture();
  const knotMat = mat(0xffffff, { map: knotTex });
  const knot = outline(mesh(new THREE.SphereGeometry(0.07, 12, 10), knotMat, 0, 0.94, -0.44), 1.1);
  const ends: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    // 結び目から左右後ろに跳ねる布の端
    const end = outline(mesh(new THREE.ConeGeometry(0.075, 0.26, 4), knotMat, sx * 0.11, 0.99, -0.38), 1.1);
    end.rotation.set(0.6, 0, -sx * 1.0);
    ends.push(end);
  }
  const bib = outline(mesh(new THREE.ConeGeometry(0.16, 0.26, 3), knotMat, 0, 0.5, -0.76), 1.06);
  bib.rotation.set(Math.PI + 0.35, Math.PI, 0);
  bib.scale.z = 0.35;
  spin.add(band, knot, ...ends, bib);

  // 頭: 走る犬のように低め・前寄りに置いて、後ろから見ても胴の上に乗った玉に見えないようにする
  const head = new THREE.Group();
  head.position.set(0, 0.86, -0.8);
  const skull = outline(mesh(new THREE.SphereGeometry(0.25, 24, 16), fur, 0, 0, 0));
  skull.scale.set(1.02, 0.92, 1.05);
  // 横に張った頬の毛（後ろから見たときに頭が丸い玉に見えないように）
  for (const sx of [-1, 1]) {
    // 頬の裏白は後ろから見ても白く見える（柴らしさのポイント）
    const ruff = mesh(new THREE.SphereGeometry(0.11, 12, 10), cream, sx * 0.15, -0.09, 0.02);
    ruff.scale.set(1, 0.85, 1.1);
    head.add(ruff);
  }
  const cheekL = mesh(new THREE.SphereGeometry(0.11, 14, 10), cream, -0.1, -0.1, -0.14);
  const cheekR = mesh(new THREE.SphereGeometry(0.11, 14, 10), cream, 0.1, -0.1, -0.14);
  const muzzle = outline(mesh(new THREE.SphereGeometry(0.11, 14, 10), cream, 0, -0.07, -0.28), 1.05);
  muzzle.scale.set(0.8, 0.68, 1.45);
  const nose = mesh(new THREE.SphereGeometry(0.045, 10, 8), black, 0, -0.03, -0.43);
  const mouth = mesh(new THREE.SphereGeometry(0.03, 8, 6), pink, 0, -0.13, -0.36);
  mouth.scale.set(1.2, 0.6, 0.6);
  const eyes: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.042, 10, 8), black, sx * 0.11, 0.05, -0.23);
    eye.add(mesh(new THREE.SphereGeometry(0.014, 6, 4), white, 0.012, 0.016, -0.034));
    eyes.push(eye);
    // 麻呂眉
    const brow = mesh(new THREE.SphereGeometry(0.035, 8, 6), cream, sx * 0.1, 0.13, -0.22);
    brow.scale.set(1.3, 0.7, 0.6);
    head.add(eye, brow);
  }
  // 三角の立ち耳（3角錐の平らな面が前を向く）
  const ears: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(sx * 0.14, 0.18, -0.02);
    ear.rotation.set(-0.35, 0, -sx * 0.32);
    const outer = mesh(new THREE.ConeGeometry(0.115, 0.22, 3), fur, 0, 0.09, 0);
    const inner = mesh(new THREE.ConeGeometry(0.068, 0.14, 3), pink, 0, 0.06, -0.036);
    ear.add(outer, inner);
    ears.push(ear);
    head.add(ear);
  }
  head.add(skull, cheekL, cheekR, muzzle, nose, mouth);
  spin.add(head);

  // 背中に乗ったくるんと巻いた尾（後ろから見ると輪っか）
  const tail = new THREE.Group();
  tail.position.set(-0.03, 0.8, 0.46);
  tail.rotation.set(-0.75, 0, 0.35);
  const curl = outline(mesh(new THREE.TorusGeometry(0.11, 0.075, 12, 28, Math.PI * 1.7), fur, 0, 0.12, 0));
  curl.rotation.z = -Math.PI / 2;
  const a = Math.PI * 1.7 - Math.PI / 2;
  const tip = mesh(new THREE.SphereGeometry(0.07, 10, 8), cream, Math.cos(a) * 0.11, 0.12 + Math.sin(a) * 0.11, 0);
  tail.add(curl, tip);
  spin.add(tail);

  // 足（白いソックス付き）
  const legs: THREE.Group[] = [];
  const upperGeo = new THREE.CylinderGeometry(0.075, 0.065, 0.28, 10).translate(0, -0.14, 0);
  const pawGeo = new THREE.SphereGeometry(0.075, 10, 8);
  for (const [x, z] of [[-0.15, -0.36], [0.15, -0.36], [-0.15, 0.38], [0.15, 0.38]]) {
    const leg = new THREE.Group();
    leg.position.set(x, 0.42, z);
    // 後ろ足は裏白の「白いパンツ」
    const upper = mesh(upperGeo, z > 0 ? cream : furDark, 0, 0, 0);
    const paw = mesh(pawGeo, cream, 0, -0.32, -0.02);
    paw.scale.set(1, 0.75, 1.25);
    leg.add(outline(upper, 1.12), paw);
    legs.push(leg);
    spin.add(leg);
  }

  const towel = mesh(new THREE.BoxGeometry(0.75, 0.12, 0.6), mat(0xffffff, { map: stripeTexture() }), 0, 0.28, 0);
  towel.visible = false;
  head.add(towel);

  const ring = mesh(
    new THREE.TorusGeometry(0.8, 0.06, 8, 32, Math.PI * 1.4),
    new THREE.MeshBasicMaterial({ color: 0x6cc0ff, transparent: true, opacity: 0.75 }),
    0, 0.6, 0,
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  root.add(ring);

  const shadow = blobShadow(0.45 * SHIBA_SCALE);
  return { root, spin, legs, head, ears, tail, eyes, shadow, towel, ring, furMats: [fur, furDark] };
}

interface OwnerParts {
  root: THREE.Group;
  legs: THREE.Mesh[];
  showerMat: THREE.MeshToonMaterial;
}

function buildOwner(): OwnerParts {
  const root = new THREE.Group();
  const skin = mat(0xf2c9a0);
  const shirt = mat(0xff7b54);
  const pants = mat(0x3d5a80);
  const hair = mat(0x5a3b2e);
  const showerMat = mat(0xc9d3dd);

  const legs: THREE.Mesh[] = [];
  const legGeo = new THREE.CylinderGeometry(0.13, 0.11, 0.7, 10);
  legGeo.translate(0, -0.35, 0);
  for (const x of [-0.17, 0.17]) {
    const leg = mesh(legGeo, pants, x, 0.7, 0);
    legs.push(leg);
    root.add(leg);
  }
  const body = mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.8, 16), shirt, 0, 1.1, 0);
  const head = mesh(new THREE.SphereGeometry(0.27, 16, 12), skin, 0, 1.72, 0);
  const hairM = mesh(new THREE.SphereGeometry(0.29, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 1.75, 0.03);
  const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8);
  const armL = mesh(armGeo, skin, -0.42, 1.15, -0.05);
  armL.rotation.z = 0.2;
  const armR = mesh(armGeo, skin, 0.38, 1.35, -0.3);
  armR.rotation.x = Math.PI / 2.4;
  const shower = mesh(new THREE.CylinderGeometry(0.16, 0.1, 0.1, 16), showerMat, 0.38, 1.55, -0.62);
  shower.rotation.x = Math.PI / 2;
  const hosePath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.38, 1.5, -0.55),
    new THREE.Vector3(0.6, 1.0, -0.2),
    new THREE.Vector3(0.5, 0.4, 0.6),
    new THREE.Vector3(0.3, 0.05, 1.6),
  ]);
  const hose = new THREE.Mesh(new THREE.TubeGeometry(hosePath, 20, 0.04, 6), mat(0x8a97a6));
  root.add(body, head, hairM, armL, armR, shower, hose, blobShadow(0.55));
  return { root, legs, showerMat };
}

function buildThing(kind: Thing['kind']): THREE.Group {
  const g = new THREE.Group();
  switch (kind) {
    case 'bucket': {
      const blue = mat(0x4f86c6, { side: THREE.DoubleSide });
      g.add(mesh(new THREE.CylinderGeometry(0.45, 0.34, 0.62, 20, 1, true), blue, 0, 0.31, 0));
      g.add(mesh(new THREE.CircleGeometry(0.34, 20).rotateX(-Math.PI / 2), mat(0x2f5f99), 0, 0.03, 0));
      const rim = mesh(new THREE.TorusGeometry(0.45, 0.04, 8, 24), mat(0x7fb2e8), 0, 0.62, 0);
      rim.rotation.x = Math.PI / 2;
      const handle = mesh(new THREE.TorusGeometry(0.42, 0.025, 6, 20, Math.PI), mat(0x2f5f99), 0, 0.62, 0);
      handle.rotation.y = 0.4;
      g.add(rim, handle, blobShadow(0.5));
      break;
    }
    case 'soap': {
      const soap = mesh(new THREE.BoxGeometry(0.7, 0.22, 0.45), mat(0xff9ec7), 0, 0.11, 0);
      const bubbleMat = new THREE.MeshToonMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
      for (const [x, y, z, r] of [[-0.25, 0.32, 0.1, 0.1], [0.12, 0.38, -0.1, 0.08], [0.3, 0.28, 0.12, 0.06]]) {
        g.add(mesh(new THREE.SphereGeometry(r, 10, 8), bubbleMat, x, y, z));
      }
      g.add(soap, blobShadow(0.45));
      break;
    }
    case 'towel': {
      const towel = mesh(new THREE.BoxGeometry(1.5, 0.3, 0.8), mat(0xffffff, { map: stripeTexture() }), 0, 0.15, 0);
      g.add(towel, blobShadow(0.7));
      break;
    }
    case 'potato': {
      const inner = new THREE.Group();
      const body = mesh(new THREE.SphereGeometry(0.25, 16, 12), mat(0x8e44ad), 0, 0, 0);
      body.scale.set(1.8, 1, 1);
      const yellow = mat(0xf6d365);
      inner.add(body, mesh(new THREE.SphereGeometry(0.1, 8, 6), yellow, 0.42, 0, 0), mesh(new THREE.SphereGeometry(0.08, 8, 6), yellow, -0.42, 0, 0));
      inner.position.y = 0.5;
      inner.name = 'spin';
      g.add(inner, blobShadow(0.4));
      break;
    }
    case 'sasami': {
      const inner = new THREE.Group();
      const s = mesh(new THREE.CapsuleGeometry(0.12, 0.5, 4, 10), mat(0xffe3e3), 0, 0, 0);
      s.rotation.z = Math.PI / 2;
      inner.add(s);
      inner.position.y = 0.45;
      inner.name = 'spin';
      g.add(inner, blobShadow(0.35));
      break;
    }
  }
  return g;
}

const waterMat = new THREE.MeshToonMaterial({ color: 0x3fa7ff, transparent: true, opacity: 0.8 });

function buildSplash(wide: boolean): THREE.Group {
  const g = new THREE.Group();
  if (wide) {
    const wave = mesh(new THREE.BoxGeometry(FLOOR_W - 0.4, 1.0, 0.6, 24, 1, 1), waterMat, 0, 0.5, 0);
    const pos = wave.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 0) pos.setY(i, 0.5 + Math.sin(pos.getX(i) * 3) * 0.15);
    }
    wave.geometry.computeVertexNormals();
    const crest = mesh(new THREE.BoxGeometry(FLOOR_W - 0.4, 0.12, 0.3), mat(0xffffff, { transparent: true, opacity: 0.85 }), 0, 1.0, -0.15);
    g.add(wave, crest);
  } else {
    for (let i = 0; i < 4; i++) {
      const d = mesh(new THREE.SphereGeometry(0.2 - i * 0.035, 10, 8), waterMat, 0, 0.6, i * 0.28);
      d.scale.z = 1.4;
      g.add(d);
    }
  }
  const warn = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x2890ff, transparent: true, opacity: 0.25, depthWrite: false }),
  );
  warn.name = 'warn';
  warn.position.y = 0.02;
  g.add(warn);
  return g;
}

export class World {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, 0.5, 0.1, 100);
  private floorTex: THREE.CanvasTexture;
  private wallTexL: THREE.CanvasTexture;
  private wallTexR: THREE.CanvasTexture;
  private shiba = buildShiba();
  private owner = buildOwner();
  private things = new Map<Thing, THREE.Group>();
  private splashes = new Map<Splash, THREE.Group>();
  private particles: THREE.InstancedMesh;
  private tmp = new THREE.Object3D();
  private tmpColor = new THREE.Color();
  private tmpVec = new THREE.Vector3();
  private width = 1;
  private height = 1;
  private lastT = 0;
  private titleBlend = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setClearColor(BG);
    this.scene.fog = new THREE.Fog(BG, 26, 48);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9fc9d9, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(3, 8, 4);
    this.scene.add(sun);

    this.floorTex = tileTexture('#e6f5fa', '#c3e1ec', FLOOR_W / TILE, FLOOR_L / TILE);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR_W, FLOOR_L), new THREE.MeshLambertMaterial({ map: this.floorTex }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -FLOOR_L / 2 + 12;
    this.scene.add(floor);

    const laneMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
    for (const x of [-0.95, 0.95]) {
      const line = mesh(new THREE.PlaneGeometry(0.06, FLOOR_L).rotateX(-Math.PI / 2), laneMat, x, 0.005, floor.position.z);
      this.scene.add(line);
    }

    this.wallTexL = tileTexture('#a9d6e5', '#8cc2d6', FLOOR_L / TILE, 3 / TILE);
    this.wallTexR = this.wallTexL.clone();
    for (const side of [-1, 1]) {
      const tex = side < 0 ? this.wallTexL : this.wallTexR;
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR_L, 3), new THREE.MeshLambertMaterial({ map: tex }));
      wall.rotation.y = -side * Math.PI / 2;
      wall.position.set(side * FLOOR_W / 2, 1.5, floor.position.z);
      this.scene.add(wall);
    }

    this.scene.add(this.shiba.root, this.shiba.shadow, this.owner.root);

    this.particles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshBasicMaterial(), MAX_PARTICLES);
    this.particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particles.frustumCulled = false;
    this.scene.add(this.particles);
  }

  resize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.renderer.setPixelRatio(Math.min(dpr, 2));
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    // 縦長画面でも3レーン全部が収まるよう、横方向の画角から縦の画角を決める
    const hfov = 2 * Math.atan(3.4 / 13.5);
    const vfov = 2 * Math.atan(Math.tan(hfov / 2) / aspect);
    this.camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(vfov), 45, 80);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** ワールド座標をキャンバス上の CSS px に変換（ポップアップ表示用） */
  project(x: number, h: number, y: number): { x: number; y: number } {
    this.tmpVec.set(wx(x), h * U, wz(y)).project(this.camera);
    return { x: (this.tmpVec.x * 0.5 + 0.5) * this.width, y: (-this.tmpVec.y * 0.5 + 0.5) * this.height };
  }

  render(g: Game): void {
    const t = performance.now() / 1000;
    const dist = g.distance * U;
    this.floorTex.offset.y = (dist / TILE) % 1;
    this.wallTexL.offset.x = (dist / TILE) % 1;
    this.wallTexR.offset.x = -(dist / TILE) % 1;

    this.updateShiba(g, t);
    this.updateOwner(g, t);
    this.syncThings(g, t);
    this.syncSplashes(g, t);
    this.updateParticles(g.particles);

    // カメラ: プレイ中は柴の後ろ上方から見下ろす（前方の見通し優先）。左右は少しだけ追従
    // タイトルでは柴の顔が見えるように寄る
    const dt = Math.min(0.1, t - this.lastT);
    this.lastT = t;
    this.titleBlend += ((g.scene === 'title' ? 1 : 0) - this.titleBlend) * Math.min(1, dt * 3);
    const k = this.titleBlend;
    const shake = g.shake > 0 ? g.shake * 0.4 : 0;
    const boostPull = g.boostT > 0 ? 0.8 : 0;
    this.camera.position.set(
      wx(g.x) * 0.35 + THREE.MathUtils.lerp(CAM_SIDE, 0, k) + (Math.random() - 0.5) * shake,
      THREE.MathUtils.lerp(10.5, 3.3, k) + (Math.random() - 0.5) * shake,
      THREE.MathUtils.lerp(8.5 + boostPull, 4.8, k),
    );
    this.camera.lookAt(wx(g.x) * 0.25 + THREE.MathUtils.lerp(CAM_SIDE * 0.3, 0, k), THREE.MathUtils.lerp(0, 0.9, k), THREE.MathUtils.lerp(-5, -1.4, k));
    this.renderer.render(this.scene, this.camera);
  }

  private updateShiba(g: Game, t: number): void {
    const s = this.shiba;
    const x = wx(g.x);
    const y = g.z * U;
    s.root.position.set(x, y, 0);
    s.shadow.position.set(x, 0.01, 0);
    s.shadow.scale.setScalar(1 - y * 0.25);

    const running = g.scene === 'playing';
    const grounded = g.z === 0;
    const phase = g.runPhase;
    // ギャロップ: 前足ペアと後ろ足ペアが交互に動く
    s.legs.forEach((leg, i) => {
      const front = i < 2;
      if (!running) leg.rotation.x = 0;
      else if (!grounded) leg.rotation.x = front ? -0.9 : 0.9;
      else leg.rotation.x = Math.sin(phase + (front ? 0 : Math.PI) + (i % 2) * 0.4) * 0.75;
    });
    s.spin.position.y = running && grounded ? Math.abs(Math.sin(phase)) * 0.06 : 0;
    s.head.rotation.x = running ? Math.sin(phase * 2) * 0.05 : Math.sin(t * 2) * 0.05;
    s.ears.forEach((ear, i) => (ear.rotation.z = (i === 0 ? 0.32 : -0.32) + Math.sin(t * 9 + i) * (running ? 0.06 : 0.02)));
    // しっぽはふりふり。走っている間は速く
    s.tail.rotation.z = Math.sin(t * (running ? 14 : 8)) * 0.25;
    // ときどきまばたき
    const blink = t % 3.2 < 0.12 ? 0.15 : 1;
    s.eyes.forEach((e) => (e.scale.y = blink));

    let rotY = 0;
    let rotZ = 0;
    if (g.drillT > 0) rotY = g.drillT * 40;
    if (g.slipT > 0) rotY = Math.sin(g.slipT * 25) * 0.8;
    if (g.stumbleT > 0) rotZ = Math.sin(g.stumbleT * 40) * 0.3;
    // レーン移動中は進行方向に少し体を傾ける
    rotZ += (laneX(g.lane) - g.x) * -0.004;
    if (g.scene === 'title') {
      // タイトルではこっちを向いておすわり気味にゆらゆら
      rotY = Math.PI + Math.sin(t * 1.5) * 0.25;
      rotZ = 0;
    } else if (g.scene === 'over') {
      // 捕まったら振り向いてブルブル
      rotY = Math.PI;
      rotZ = 0.15 * Math.sin(t * 30);
    }
    s.spin.rotation.set(0, rotY, rotZ);

    s.ring.visible = g.drillT > 0;
    s.ring.rotation.z = t * 25;
    s.towel.visible = g.blindT > 0;

    const glow = g.boostT > 0 ? 0.35 + 0.15 * Math.sin(t * 20) : 0;
    for (const m of s.furMats) {
      m.emissive.setRGB(glow, glow * 0.6, 0);
      if (g.wetT > 0 || g.scene === 'over') m.emissive.setRGB(0, 0.03, 0.1);
    }
  }

  private updateOwner(g: Game, t: number): void {
    const o = this.owner;
    o.root.visible = g.scene !== 'title';
    if (g.scene === 'over') {
      // 捕まえたら柴の横に立ってシャワーを向ける（柴が隠れないように）
      const side = g.x > W / 2 ? -1 : 1;
      o.root.position.set(wx(g.x) + side * 1.0, 0, 0.2);
      o.root.rotation.y = side * Math.PI / 2;
      o.legs.forEach((leg) => (leg.rotation.x = 0));
      o.showerMat.emissive.setRGB(0.6, 0.8, 1);
      return;
    }
    o.root.rotation.y = 0;
    o.root.position.set(wx(g.ownerX), Math.abs(Math.sin(t * 7)) * 0.08, wz(g.ownerY));
    o.legs.forEach((leg, i) => (leg.rotation.x = Math.sin(t * 14 + i * Math.PI) * 0.6));
    o.showerMat.emissive.setRGB(g.ownerAim > 0 ? 0.6 : 0, g.ownerAim > 0 ? 0.8 : 0, g.ownerAim > 0 ? 1 : 0);
  }

  private syncThings(g: Game, t: number): void {
    const alive = new Set(g.things);
    for (const [thing, obj] of this.things) {
      if (!alive.has(thing)) {
        this.scene.remove(obj);
        this.things.delete(thing);
      }
    }
    for (const thing of g.things) {
      let obj = this.things.get(thing);
      if (!obj) {
        obj = buildThing(thing.kind);
        this.things.set(thing, obj);
        this.scene.add(obj);
      }
      obj.position.set(wx(laneX(thing.lane)), 0, wz(thing.y));
      const spin = obj.getObjectByName('spin');
      if (spin) {
        spin.rotation.y = t * 3;
        spin.position.y = 0.5 + Math.sin(t * 4 + thing.y) * 0.08;
      }
    }
  }

  private syncSplashes(g: Game, t: number): void {
    const alive = new Set(g.splashes);
    for (const [s, obj] of this.splashes) {
      if (!alive.has(s)) {
        this.scene.remove(obj);
        this.splashes.delete(s);
      }
    }
    for (const s of g.splashes) {
      let obj = this.splashes.get(s);
      if (!obj) {
        obj = buildSplash(s.wide);
        this.splashes.set(s, obj);
        this.scene.add(obj);
      }
      const x = s.wide ? 0 : wx(laneX(s.lane));
      obj.position.set(x, 0, wz(s.y));
      const warn = obj.getObjectByName('warn')!;
      // 予告中は狙っているレーンを点滅させる
      warn.visible = s.warn > 0 && Math.floor(s.warn * 12) % 2 === 0;
      const len = 28;
      warn.scale.set(s.wide ? FLOOR_W - 0.2 : 1.8, 1, len);
      warn.position.z = -len / 2;
      for (const child of obj.children) {
        if (child !== warn) child.visible = s.warn <= 0;
      }
      if (s.wide) obj.position.y = Math.sin(t * 10) * 0.05;
    }
  }

  private updateParticles(ps: Particle[]): void {
    const n = Math.min(ps.length, MAX_PARTICLES);
    for (let i = 0; i < n; i++) {
      const p = ps[i];
      const k = Math.max(0, p.life / p.maxLife);
      this.tmp.position.set(wx(p.x), p.h * U, wz(p.y));
      this.tmp.scale.setScalar(p.size * U * 1.6 * (0.4 + 0.6 * k));
      this.tmp.updateMatrix();
      this.particles.setMatrixAt(i, this.tmp.matrix);
      this.particles.setColorAt(i, this.tmpColor.set(p.color));
    }
    this.particles.count = n;
    this.particles.instanceMatrix.needsUpdate = true;
    if (this.particles.instanceColor) this.particles.instanceColor.needsUpdate = true;
  }
}

