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
  legs: THREE.Mesh[];
  shadow: THREE.Mesh;
  towel: THREE.Mesh;
  ring: THREE.Mesh;
  furMats: THREE.MeshToonMaterial[];
}

function buildShiba(): ShibaParts {
  const root = new THREE.Group();
  const spin = new THREE.Group();
  root.add(spin);
  const fur = mat(0xe8913f);
  const furDark = mat(0xc8742a);
  const cream = mat(0xfff1dc);
  const black = mat(0x2a1d16);

  const body = mesh(new THREE.SphereGeometry(0.32, 20, 14), fur, 0, 0.55, 0);
  body.scale.set(1, 0.85, 1.5);
  const belly = mesh(new THREE.SphereGeometry(0.26, 16, 10), cream, 0, 0.45, -0.1);
  belly.scale.set(0.9, 0.7, 1.3);
  const head = mesh(new THREE.SphereGeometry(0.3, 20, 14), fur, 0, 0.9, -0.55);
  const cheeks = mesh(new THREE.SphereGeometry(0.22, 16, 10), cream, 0, 0.82, -0.68);
  cheeks.scale.set(1.2, 0.8, 1);
  const snout = mesh(new THREE.SphereGeometry(0.13, 12, 8), cream, 0, 0.84, -0.86);
  const nose = mesh(new THREE.SphereGeometry(0.05, 8, 6), black, 0, 0.88, -0.98);
  const earGeo = new THREE.ConeGeometry(0.1, 0.24, 4);
  const earL = mesh(earGeo, fur, -0.16, 1.18, -0.5);
  const earR = mesh(earGeo, fur, 0.16, 1.18, -0.5);
  earL.rotation.z = 0.25;
  earR.rotation.z = -0.25;
  const tail = mesh(new THREE.TorusGeometry(0.13, 0.065, 10, 20), fur, 0, 0.88, 0.48);
  const tailTip = mesh(new THREE.SphereGeometry(0.07, 8, 6), cream, 0, 0.88, 0.5);
  spin.add(body, belly, head, cheeks, snout, nose, earL, earR, tail, tailTip);

  const legs: THREE.Mesh[] = [];
  const legGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.4, 8);
  legGeo.translate(0, -0.2, 0); // 付け根を回転軸にする
  for (const [x, z] of [[-0.17, -0.3], [0.17, -0.3], [-0.17, 0.3], [0.17, 0.3]]) {
    const leg = mesh(legGeo, furDark, x, 0.42, z);
    legs.push(leg);
    spin.add(leg);
  }

  const towel = mesh(new THREE.BoxGeometry(0.75, 0.12, 0.6), mat(0xffffff, { map: stripeTexture() }), 0, 1.1, -0.6);
  towel.visible = false;
  spin.add(towel);

  const ring = mesh(
    new THREE.TorusGeometry(0.8, 0.06, 8, 32, Math.PI * 1.4),
    new THREE.MeshBasicMaterial({ color: 0x6cc0ff, transparent: true, opacity: 0.75 }),
    0, 0.6, 0,
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  root.add(ring);

  const shadow = blobShadow(0.45);
  return { root, spin, legs, shadow, towel, ring, furMats: [fur, furDark] };
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

    // カメラ: 柴の後ろ上方から見下ろす（前方の見通し優先）。左右は少しだけ追従
    const shake = g.shake > 0 ? g.shake * 0.4 : 0;
    const boostPull = g.boostT > 0 ? 0.8 : 0;
    this.camera.position.set(
      wx(g.x) * 0.35 + (Math.random() - 0.5) * shake,
      10.5 + (Math.random() - 0.5) * shake,
      8.5 + boostPull,
    );
    this.camera.lookAt(wx(g.x) * 0.25, 0, -5);
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
    const phase = running ? g.runPhase : t * 2;
    s.legs.forEach((leg, i) => {
      leg.rotation.x = running && g.z === 0 ? Math.sin(phase + (i % 2 === 0 ? 0 : Math.PI) + (i >= 2 ? Math.PI : 0)) * 0.7 : g.z > 0 ? (i < 2 ? -0.8 : 0.8) : 0;
    });
    s.spin.position.y = running && g.z === 0 ? Math.abs(Math.sin(phase)) * 0.06 : 0;

    let rotY = 0;
    let rotZ = 0;
    if (g.drillT > 0) rotY = g.drillT * 40;
    if (g.slipT > 0) rotY = Math.sin(g.slipT * 25) * 0.8;
    if (g.stumbleT > 0) rotZ = Math.sin(g.stumbleT * 40) * 0.3;
    // レーン移動中は進行方向に少し体を傾ける
    rotZ += (laneX(g.lane) - g.x) * -0.004;
    if (g.scene === 'over') rotZ = 0.2 * Math.sin(t * 20);
    s.spin.rotation.set(0, rotY, rotZ);

    s.ring.visible = g.drillT > 0;
    s.ring.rotation.z = t * 25;
    s.towel.visible = g.blindT > 0;

    const glow = g.boostT > 0 ? 0.35 + 0.15 * Math.sin(t * 20) : 0;
    for (const m of s.furMats) {
      m.emissive.setRGB(glow, glow * 0.6, 0);
      if (g.wetT > 0) m.emissive.setRGB(0, 0.08, 0.25);
    }
  }

  private updateOwner(g: Game, t: number): void {
    const o = this.owner;
    o.root.visible = g.scene !== 'title';
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

