/** Screen-space performances. The specimen stays in the lab's view; this is the weather it throws. */

import type { MassClass } from "./types.ts";

export interface FxSpec {
  element: string;
  motion: string;
  seed: number;
  mass?: MassClass;
  title?: string;
  intensity?: number;
  /** Canvas pixels. When set, the weather leaves the specimen and starts on the fighter. */
  from?: { x: number; y: number };
  toward?: { x: number; y: number };
}

type RGB = [number, number, number];

interface Palette {
  core: RGB;
  mid: RGB;
  edge: RGB;
  smoke: RGB;
  spark: RGB;
}

const PALETTE: Record<string, Palette> = {
  fire: { core: [255, 244, 220], mid: [255, 122, 36], edge: [170, 28, 8], smoke: [48, 28, 22], spark: [255, 214, 120] },
  water: { core: [232, 248, 255], mid: [56, 156, 210], edge: [10, 64, 112], smoke: [170, 200, 210], spark: [220, 255, 255] },
  ice: { core: [246, 252, 255], mid: [176, 226, 244], edge: [70, 150, 186], smoke: [214, 232, 238], spark: [255, 255, 255] },
  electric: { core: [245, 255, 255], mid: [110, 220, 255], edge: [36, 70, 255], smoke: [16, 20, 36], spark: [230, 255, 90] },
  plasma: { core: [255, 255, 255], mid: [255, 110, 210], edge: [110, 30, 240], smoke: [28, 8, 28], spark: [255, 220, 255] },
  earth: { core: [226, 198, 150], mid: [138, 92, 48], edge: [64, 42, 24], smoke: [92, 74, 54], spark: [210, 170, 110] },
  plant: { core: [226, 255, 186], mid: [78, 168, 52], edge: [16, 78, 32], smoke: [36, 48, 26], spark: [190, 230, 70] },
  air: { core: [255, 255, 255], mid: [206, 226, 236], edge: [130, 164, 184], smoke: [196, 208, 216], spark: [255, 255, 255] },
  metal: { core: [255, 250, 242], mid: [186, 194, 204], edge: [72, 78, 88], smoke: [46, 48, 52], spark: [255, 196, 110] },
  light: { core: [255, 252, 236], mid: [255, 208, 110], edge: [255, 150, 48], smoke: [255, 228, 186], spark: [255, 255, 255] },
  void: { core: [210, 180, 255], mid: [110, 40, 170], edge: [18, 0, 28], smoke: [8, 6, 14], spark: [190, 150, 255] },
  beast: { core: [255, 228, 210], mid: [176, 92, 62], edge: [86, 34, 26], smoke: [58, 38, 30], spark: [255, 176, 130] },
};

interface Phys {
  grav: number;
  drag: number;
  smoke: number;
  bolt: number;
  shape: 0 | 1 | 2;
}

const PHYS: Record<string, Phys> = {
  fire: { grav: -220, drag: 0.55, smoke: 0.2, bolt: 0, shape: 0 },
  water: { grav: 260, drag: 1.35, smoke: 0.12, bolt: 0, shape: 0 },
  ice: { grav: 36, drag: 0.22, smoke: 0.06, bolt: 0, shape: 1 },
  electric: { grav: 0, drag: 0.08, smoke: 0, bolt: 1, shape: 0 },
  plasma: { grav: -24, drag: 0.28, smoke: 0.05, bolt: 0.65, shape: 0 },
  earth: { grav: 620, drag: 0.9, smoke: 0.28, bolt: 0, shape: 1 },
  plant: { grav: 24, drag: 0.7, smoke: 0.08, bolt: 0, shape: 0 },
  air: { grav: -36, drag: 0.12, smoke: 0.04, bolt: 0, shape: 0 },
  metal: { grav: 420, drag: 0.55, smoke: 0.04, bolt: 0, shape: 1 },
  light: { grav: -12, drag: 0.04, smoke: 0, bolt: 0, shape: 0 },
  void: { grav: 0, drag: 0.18, smoke: 0.02, bolt: 0, shape: 0 },
  beast: { grav: 180, drag: 0.75, smoke: 0.1, bolt: 0, shape: 2 },
};

interface Particle {
  alive: boolean;
  layer: 0 | 1;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  r: number;
  g: number;
  b: number;
  grav: number;
  drag: number;
  kind: 0 | 1 | 2;
  spin: number;
  ang: number;
  pull: number;
}

interface Ring {
  x: number;
  y: number;
  radius: number;
  vr: number;
  life: number;
  max: number;
  r: number;
  g: number;
  b: number;
  width: number;
  arc: number;
  rot: number;
}

interface Bolt {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  life: number;
  max: number;
  seed: number;
  r: number;
  g: number;
  b: number;
}

interface Vine {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  cx: number;
  cy: number;
  growth: number;
  r: number;
  g: number;
  b: number;
}

interface Variation {
  rnd: () => number;
  spread: number;
  spin: number;
  echoes: number;
  tilt: number;
  size: number;
  late: boolean;
  mix: number;
  rate: number;
  side: number;
}

const pool: Particle[] = [];
for (let i = 0; i < 420; i++) {
  pool.push({
    alive: false, layer: 0, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, life: 0, max: 1,
    size: 1, r: 255, g: 255, b: 255, grav: 0, drag: 0, kind: 0, spin: 0, ang: 0, pull: 0,
  });
}

let canvas: HTMLCanvasElement | null = null;
let ctx2: CanvasRenderingContext2D | null = null;
let soft: HTMLCanvasElement | null = null;
let shard: HTMLCanvasElement | null = null;
let raf = 0;
let running = false;
let reduced = false;
let audio: AudioContext | null = null;
let noise: AudioBuffer | null = null;

let spec: FxSpec = { element: "beast", motion: "burst", seed: 1 };
let palette: Palette = PALETTE.beast!;
let phys: Phys = PHYS.beast!;
let vary: Variation = { rnd: Math.random, spread: 1, spin: 1, echoes: 1, tilt: 0, size: 1, late: false, mix: 0, rate: 1, side: 1 };
let intensity = 1;
let duration = 1.6;
let elapsed = 0;
let lastU = 0;
let spawnAcc = 0;
let shake = 0;
let ox = 0;
let oy = 0;
let aim = 0;
const rings: Ring[] = [];
const bolts: Bolt[] = [];
const vines: Vine[] = [];

function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function makeVariation(seed: number): Variation {
  let s = seed >>> 0 || 1;
  const rnd = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return {
    rnd,
    spread: 0.68 + rnd() * 0.8,
    spin: (rnd() < 0.5 ? -1 : 1) * (0.45 + rnd() * 2.1),
    echoes: 1 + Math.floor(rnd() * 3),
    tilt: -0.55 + rnd() * 1.15,
    size: 0.7 + rnd() * 0.8,
    late: rnd() < 0.4,
    mix: rnd(),
    rate: 0.68 + rnd() * 0.7,
    side: rnd() < 0.5 ? -1 : 1,
  };
}

function ensureCanvas(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  const app = document.getElementById("app") ?? document.body;
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "primordia-fx";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:6;";
    app.append(canvas);
    soft = sprite(false);
    shard = sprite(true);
    reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    const fit = () => resize();
    window.addEventListener("resize", fit);
    const view = document.getElementById("view");
    if (view && "ResizeObserver" in window) new ResizeObserver(fit).observe(view);
  }
  resize();
  ctx2 = canvas.getContext("2d");
  return ctx2;
}

function sprite(diamond: boolean): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  if (!diamond) {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.22, "rgba(255,255,255,0.9)");
    grd.addColorStop(0.5, "rgba(255,255,255,0.28)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  } else {
    g.translate(32, 32);
    g.scale(0.42, 1);
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, 30);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.45, "rgba(255,255,255,0.75)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(0, -30);
    g.lineTo(22, 0);
    g.lineTo(0, 30);
    g.lineTo(-22, 0);
    g.fill();
  }
  return c;
}

function resize() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  placeOrigin();
}

function placeOrigin() {
  if (!canvas) return;
  const view = document.getElementById("view");
  const sheet = document.querySelector(".sheet");
  const vr = view?.getBoundingClientRect();
  const sr = sheet?.getBoundingClientRect();
  const cr = canvas.getBoundingClientRect();
  const width = cr.width || 1;
  const height = cr.height || 1;
  const top = vr ? vr.top - cr.top : 0;
  const bottom = sr ? Math.min(height, sr.top - cr.top) : height;
  const visH = Math.max(80, bottom - top);
  if (spec.from) {
    ox = spec.from.x;
    oy = spec.from.y;
    if (spec.toward) aim = Math.atan2(spec.toward.y - oy, spec.toward.x - ox);
    else aim = vary.tilt - 0.18;
    return;
  }
  ox = width * 0.5;
  oy = top + visH * 0.46;
  aim = vary.tilt - 0.18;
}

function tinted(src: HTMLCanvasElement, rgb: RGB): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  g.fillRect(0, 0, 64, 64);
  return c;
}

const tintCache = new Map<string, HTMLCanvasElement>();
function stamp(kind: 0 | 1 | 2, rgb: RGB): HTMLCanvasElement {
  const key = `${kind}:${rgb.join(",")}`;
  const hit = tintCache.get(key);
  if (hit) return hit;
  const base = kind === 1 ? shard! : soft!;
  const painted = tinted(base, rgb);
  tintCache.set(key, painted);
  return painted;
}

function spawn(x: number, y: number, vx: number, vy: number, life: number, size: number, rgb: RGB, layer: 0 | 1, kind: 0 | 1 | 2, pull = 0) {
  const p = pool.find((q) => !q.alive);
  if (!p) return;
  p.alive = true;
  p.layer = layer;
  p.x = x;
  p.y = y;
  p.px = x;
  p.py = y;
  p.vx = vx;
  p.vy = vy;
  p.life = life;
  p.max = life;
  p.size = size * vary.size * (1.25 + intensity * 0.55);
  p.r = rgb[0];
  p.g = rgb[1];
  p.b = rgb[2];
  p.grav = phys.grav;
  p.drag = phys.drag;
  p.kind = kind;
  p.spin = vary.spin * (0.4 + Math.random());
  p.ang = Math.random() * Math.PI * 2;
  p.pull = pull;
}

function ring(x: number, y: number, radius: number, vr: number, life: number, rgb: RGB, width: number, arc = Math.PI * 2) {
  rings.push({ x, y, radius, vr, life, max: life, r: rgb[0], g: rgb[1], b: rgb[2], width, arc, rot: vary.tilt });
}

function bolt(x0: number, y0: number, x1: number, y1: number, life: number, rgb: RGB) {
  bolts.push({ x0, y0, x1, y1, life, max: life, seed: (vary.rnd() * 1e9) | 0, r: rgb[0], g: rgb[1], b: rgb[2] });
}

function burst(x: number, y: number, n: number, speed: number, life: number, rgb: RGB, kind?: 0 | 1 | 2) {
  const count = Math.round(n * (reduced ? 0.35 : 1) * intensity);
  const shape = kind ?? phys.shape;
  for (let i = 0; i < count; i++) {
    const a = vary.rnd() * Math.PI * 2;
    const sp = speed * (0.35 + vary.rnd() * vary.spread);
    spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp, life * (0.6 + vary.rnd() * 0.6), 8 + vary.rnd() * 18, rgb, 0, shape);
  }
  if (phys.smoke > 0 && !reduced) {
    const sm = Math.round(count * phys.smoke * 0.45);
    for (let i = 0; i < sm; i++) {
      const a = vary.rnd() * Math.PI * 2;
      spawn(x, y, Math.cos(a) * 20, Math.sin(a) * 16 - 10, life * 1.4, 18 + vary.rnd() * 28, palette.smoke, 1, 0);
    }
  }
}

function crossed(u0: number, u1: number, mark: number): boolean {
  return u0 < mark && u1 >= mark;
}

function forward(dist: number): { x: number; y: number } {
  return { x: ox + Math.cos(aim) * dist * vary.side, y: oy + Math.sin(aim) * dist * 0.72 };
}

function drive(u0: number, u1: number, dt: number) {
  const motion = spec.motion;
  const u = u1;
  const span = Math.min(canvas?.clientWidth ?? 800, canvas?.clientHeight ?? 600);
  let reach = span * 0.22 * vary.spread;
  if (spec.from && spec.toward) {
    const gap = Math.hypot(spec.toward.x - ox, spec.toward.y - oy);
    if (gap > 12) reach = gap;
  }
  const rate = (reduced ? 10 : 28) * vary.rate * intensity;
  const mid = mix(palette.core, palette.mid, 0.35 + vary.mix * 0.4);
  const edge = mix(palette.mid, palette.edge, 0.45);

  const spray = (along: number, fan: number, count: number) => {
    spawnAcc += count * dt * 60;
    while (spawnAcc >= 1) {
      spawnAcc -= 1;
      const tip = forward(along);
      const a = aim + (vary.rnd() - 0.5) * fan;
      const sp = 80 + vary.rnd() * 220 * vary.spread;
      spawn(tip.x, tip.y, Math.cos(a) * sp, Math.sin(a) * sp * 0.8, 0.35 + vary.rnd() * 0.45, 7 + vary.rnd() * 14, vary.rnd() < 0.25 ? palette.spark : mid, 0, phys.shape);
    }
  };

  if (motion === "thrust" || motion === "sting") {
    const dist = reach * Math.min(1, u * 1.35);
    spray(dist, motion === "sting" ? 0.12 : 0.28, rate);
    if (crossed(u0, u1, 0.62)) {
      const tip = forward(reach);
      burst(tip.x, tip.y, motion === "sting" ? 18 : 36, 160, 0.45, palette.spark);
      ring(tip.x, tip.y, 8, motion === "sting" ? 90 : 180, 0.35, palette.core, 2);
      shake = Math.max(shake, motion === "sting" ? 0.35 : 0.7);
    }
  } else if (motion === "arc" || motion === "grind") {
    const sweep = motion === "grind" ? Math.PI * 1.6 : Math.PI * 0.95;
    const base = aim - sweep * 0.5 * vary.side;
    const a = base + sweep * u * vary.side;
    const rad = reach * (motion === "grind" ? 0.45 : 0.85);
    const x = ox + Math.cos(a) * rad;
    const y = oy + Math.sin(a) * rad * 0.62;
    spawnAcc += rate * 1.3 * dt * 60;
    while (spawnAcc >= 1) {
      spawnAcc -= 1;
      spawn(x, y, Math.cos(a) * 40, Math.sin(a) * 30, 0.4, 8 + vary.rnd() * 12, mid, 0, phys.shape);
    }
    if (crossed(u0, u1, 0.7)) {
      burst(x, y, 22, 140, 0.4, palette.spark);
      shake = Math.max(shake, 0.45);
    }
  } else if (motion === "chain") {
    const n = 2 + vary.echoes;
    for (let i = 0; i < n; i++) {
      const mark = 0.18 + (i / n) * 0.62;
      if (!crossed(u0, u1, mark)) continue;
      const ang = aim + (i - (n - 1) / 2) * 0.38 * vary.side;
      const dist = reach * (0.45 + i * 0.18);
      const x = ox + Math.cos(ang) * dist;
      const y = oy + Math.sin(ang) * dist * 0.55 + span * 0.04;
      burst(x, y, 26, 150, 0.42, i % 2 ? palette.spark : mid);
      ring(x, y, 6, 160, 0.32, palette.core, 2);
      shake = Math.max(shake, 0.55);
    }
  } else if (motion === "lash" || motion === "yank") {
    const t = motion === "yank" ? 1 - Math.min(1, u * 1.15) : Math.min(1, u * 1.2);
    const c = forward(reach * 0.45);
    c.x += vary.side * reach * 0.35;
    c.y -= reach * 0.25;
    const end = forward(reach * 1.15);
    const x = (1 - t) * (1 - t) * ox + 2 * (1 - t) * t * c.x + t * t * end.x;
    const y = (1 - t) * (1 - t) * oy + 2 * (1 - t) * t * c.y + t * t * end.y;
    spawnAcc += rate * 1.4 * dt * 60;
    while (spawnAcc >= 1) {
      spawnAcc -= 1;
      spawn(x, y, (end.x - ox) * 0.4, (end.y - oy) * 0.4, 0.28, 6 + vary.rnd() * 8, mid, 0, 2);
    }
    if (crossed(u0, u1, 0.78)) {
      burst(end.x, end.y, 30, 200, 0.36, palette.spark);
      shake = Math.max(shake, 0.6);
    }
    if (spec.element === "plant" && vines.length < 3 && u < 0.08) {
      vines.push({ ax: ox, ay: oy, bx: c.x, by: c.y, cx: end.x, cy: end.y, growth: 0, r: mid[0], g: mid[1], b: mid[2] });
    }
  } else if (motion === "stream" || motion === "cone" || motion === "brume") {
    const fan = motion === "stream" ? 0.16 : motion === "cone" ? 0.55 + u * 0.45 : 1.15;
    const dist = reach * (motion === "brume" ? 0.7 : 1) * (0.2 + u);
    spray(dist, fan * vary.spread, motion === "brume" ? rate * 0.7 : rate * 1.5);
    if (motion !== "brume" && crossed(u0, u1, 0.5)) ring(ox, oy, 10, 70, 0.5, palette.core, 1.5, 0.8);
  } else if (motion === "burst" || motion === "pulse") {
    const marks = motion === "pulse" ? [0.2, 0.45, 0.7] : [0.22, ...Array.from({ length: vary.echoes }, (_, i) => 0.4 + i * 0.16)];
    for (const mark of marks) {
      if (!crossed(u0, u1, mark)) continue;
      burst(ox, oy, motion === "pulse" ? 20 : 40, motion === "pulse" ? 70 : 220, motion === "pulse" ? 0.7 : 0.45, mark < 0.3 ? palette.core : mid);
      ring(ox, oy, 12, motion === "pulse" ? 80 : 240, motion === "pulse" ? 0.8 : 0.4, palette.spark, motion === "pulse" ? 2 : 3);
      shake = Math.max(shake, motion === "pulse" ? 0.25 : 0.85);
    }
  } else if (motion === "volley" || motion === "rain") {
    const n = 5 + vary.echoes * 2;
    for (let i = 0; i < n; i++) {
      const mark = 0.08 + (i / n) * 0.7;
      if (!crossed(u0, u1, mark)) continue;
      if (motion === "rain") {
        const x = ox + (vary.rnd() - 0.5) * reach * 1.6;
        const y = oy - reach * 0.85;
        spawn(x, y, (ox - x) * 0.4, 280 + vary.rnd() * 180, 0.55, 6 + vary.rnd() * 8, mid, 0, 1);
      } else {
        const a = aim + (i / n - 0.5) * 0.9 * vary.spread;
        spawn(ox, oy, Math.cos(a) * (260 + vary.rnd() * 160), Math.sin(a) * 80 - 40, 0.5, 6 + vary.rnd() * 7, vary.rnd() < 0.3 ? palette.spark : edge, 0, 1);
      }
    }
    if (crossed(u0, u1, 0.86)) {
      burst(ox + vary.side * reach * 0.4, oy + 10, 16, 80, 0.3, palette.smoke);
      shake = Math.max(shake, 0.35);
    }
  } else if (motion === "spiral" || motion === "vortex" || motion === "cyclone") {
    spawnAcc += rate * 1.6 * dt * 60;
    const turns = motion === "cyclone" ? 3.2 : 2.2;
    while (spawnAcc >= 1) {
      spawnAcc -= 1;
      const t = u;
      const ang = vary.spin * turns * Math.PI * 2 * t + vary.rnd();
      const rad = motion === "vortex" ? reach * (1 - t * 0.65) : motion === "cyclone" ? reach * 0.45 : reach * t;
      const x = ox + Math.cos(ang) * rad;
      const y = oy + Math.sin(ang) * rad * (motion === "cyclone" ? 0.85 : 0.55) - (motion === "spiral" ? t * reach * 0.2 : 0);
      spawn(x, y, Math.cos(ang + 1.2) * 50, Math.sin(ang + 1.2) * 40, 0.45, 7, mid, 0, phys.shape, motion === "vortex" ? 1 : 0);
    }
  } else if (motion === "wall" || motion === "aegis") {
    if (crossed(u0, u1, 0.2) || (motion === "aegis" && crossed(u0, u1, 0.45))) {
      ring(ox, oy, motion === "aegis" ? reach * 0.25 : 8, motion === "aegis" ? 40 : 0, 0.9, palette.core, 3);
      burst(ox, oy, 24, 60, 0.8, mid);
    }
    spawnAcc += rate * dt * 60;
    while (spawnAcc >= 1) {
      spawnAcc -= 1;
      const a = vary.rnd() * Math.PI * 2;
      const rad = reach * (motion === "aegis" ? 0.55 : 0.3) * vary.spread;
      spawn(ox + Math.cos(a) * rad, oy + Math.sin(a) * rad * 0.72, Math.cos(a) * 16 * vary.spin, Math.sin(a) * 12, 0.7, 6, mid, 0, 0);
    }
  } else if (motion === "charge") {
    const dist = reach * Math.min(1, u * 1.5);
    const tip = forward(dist);
    spawnAcc += rate * 1.5 * dt * 60;
    while (spawnAcc >= 1) {
      spawnAcc -= 1;
      spawn(tip.x, tip.y, -Math.cos(aim) * 80, -Math.sin(aim) * 40, 0.25, 10, palette.core, 0, 2);
    }
    if (crossed(u0, u1, 0.68)) {
      burst(tip.x, tip.y, 48, 240, 0.4, palette.spark);
      ring(tip.x, tip.y, 10, 260, 0.35, palette.core, 3);
      shake = Math.max(shake, 1);
    }
  } else if (motion === "bite") {
    for (const side of [-1, 1]) {
      const a = aim + side * (0.9 - u * 0.7);
      const rad = reach * 0.55;
      const x = ox + Math.cos(a) * rad;
      const y = oy + Math.sin(a) * rad * 0.5;
      spawn(x, y, Math.cos(aim) * 30, Math.sin(aim) * 20, 0.3, 8, mid, 0, 2);
    }
    if (crossed(u0, u1, 0.62)) {
      burst(ox + Math.cos(aim) * reach * 0.2, oy, 28, 120, 0.32, palette.spark);
      shake = Math.max(shake, 0.5);
    }
  } else if (motion === "sigil") {
    const n = 6 + vary.echoes;
    if (u < 0.75) {
      for (let i = 0; i < n; i++) {
        const a = vary.spin * u * 4 + (i / n) * Math.PI * 2;
        const rad = reach * 0.48;
        spawn(ox + Math.cos(a) * rad, oy + Math.sin(a) * rad * 0.7, 0, 0, 0.25, 5, i % 2 ? palette.spark : mid, 0, 0);
      }
    }
    if (crossed(u0, u1, 0.72)) {
      const tip = forward(reach);
      bolt(ox, oy, tip.x, tip.y, 0.28, palette.core);
      burst(tip.x, tip.y, 20, 100, 0.35, palette.spark);
      shake = Math.max(shake, 0.4);
    }
  } else if (motion === "wing") {
    spawnAcc += rate * 1.4 * dt * 60;
    const open = Math.sin(Math.min(1, u) * Math.PI);
    while (spawnAcc >= 1) {
      spawnAcc -= 1;
      const side = vary.rnd() < 0.5 ? -1 : 1;
      const x = ox + side * reach * open * (0.3 + vary.rnd());
      const y = oy - reach * 0.15 * open + (vary.rnd() - 0.5) * 24;
      spawn(x, y, side * 80, -20 - vary.rnd() * 40, 0.45, 10, mid, 0, 0);
    }
    if (crossed(u0, u1, 0.35)) {
      ring(ox, oy, 8, 200, 0.4, palette.core, 2);
      shake = Math.max(shake, 0.45);
    }
  } else if (motion === "slam") {
    if (crossed(u0, u1, 0.48)) {
      burst(ox, oy + 16, 40, 180, 0.45, edge, 1);
      ring(ox, oy + 18, 8, 280, 0.4, palette.spark, 3);
      shake = Math.max(shake, 1);
    } else if (u < 0.48) {
      spawn(ox + (vary.rnd() - 0.5) * 12, oy - reach * (1 - u * 1.6), 0, 420, 0.2, 8, palette.core, 0, 1);
    }
  } else if (motion === "thorn") {
    const n = 8 + vary.echoes * 2;
    if (u < 0.55) {
      for (let i = 0; i < n; i++) {
        if (vary.rnd() > dt * 8) continue;
        const a = (i / n) * Math.PI * 2 + vary.tilt;
        const rad = reach * 0.15 + u * reach * 0.55;
        spawn(ox + Math.cos(a) * rad, oy + Math.sin(a) * rad * 0.7, Math.cos(a) * 40, Math.sin(a) * 30, 0.35, 5, edge, 0, 1);
      }
    }
  } else if (motion === "knit") {
    spawnAcc += rate * 0.8 * dt * 60;
    while (spawnAcc >= 1) {
      spawnAcc -= 1;
      const a = vary.rnd() * Math.PI * 2;
      const rad = reach * (0.75 - u * 0.45);
      spawn(ox + Math.cos(a) * rad, oy + Math.sin(a) * rad * 0.6, -Math.cos(a) * 36, -Math.sin(a) * 28, 0.7, 7, mix(palette.spark, palette.mid, vary.rnd()), 0, 0);
    }
  } else if (motion === "slip") {
    spawnAcc += rate * dt * 60;
    while (spawnAcc >= 1) {
      spawnAcc -= 1;
      const y = oy + (vary.rnd() - 0.4) * reach;
      spawn(ox - vary.side * 10, y, vary.side * (120 + vary.rnd() * 160), -20, 0.45, 12, mid, 0, 0);
    }
    if (crossed(u0, u1, 0.3)) ring(ox, oy, reach * 0.2, 60, 0.5, palette.core, 1.5);
  } else {
    if (crossed(u0, u1, 0.3)) burst(ox, oy, 32, 160, 0.45, mid);
  }

  if (phys.bolt > 0 && !reduced) {
    const gap = 0.16 / phys.bolt;
    for (let mark = 0.12; mark < 0.9; mark += gap) {
      if (!crossed(u0, u1, mark)) continue;
      const tip = forward(reach * (0.6 + vary.rnd() * 0.5));
      tip.x += (vary.rnd() - 0.5) * reach * 0.4;
      bolt(ox, oy, tip.x, tip.y, 0.12 + vary.rnd() * 0.08, palette.core);
    }
  }

  if (spec.element === "light" && crossed(u0, u1, 0.25)) {
    for (let i = 0; i < 5; i++) {
      const a = aim + (i - 2) * 0.22;
      const tip = { x: ox + Math.cos(a) * reach * 1.3, y: oy + Math.sin(a) * reach * 0.4 };
      bolt(ox, oy, tip.x, tip.y, 0.45, palette.spark);
    }
  }
  if (spec.element === "void" && u > 0.4 && u < 0.85) {
    spawnAcc += 6 * dt * 60;
    while (spawnAcc >= 1) {
      spawnAcc -= 1;
      const a = vary.rnd() * Math.PI * 2;
      const rad = reach * 0.9;
      spawn(ox + Math.cos(a) * rad, oy + Math.sin(a) * rad * 0.7, -Math.cos(a) * 90, -Math.sin(a) * 70, 0.55, 5, palette.spark, 0, 0, 1);
    }
  }
  if (spec.element === "plant" && motion !== "lash" && vines.length === 0 && u < 0.05) {
    const end = forward(reach);
    vines.push({
      ax: ox, ay: oy,
      bx: ox + vary.side * reach * 0.3, by: oy - reach * 0.4,
      cx: end.x, cy: end.y,
      growth: 0, r: palette.mid[0], g: palette.mid[1], b: palette.mid[2],
    });
  }
}

function drawBolt(g: CanvasRenderingContext2D, b: Bolt) {
  const n = 7;
  let seed = b.seed + Math.floor(elapsed * 24);
  const rnd = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const pts: Array<{ x: number; y: number }> = [{ x: b.x0, y: b.y0 }];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    pts.push({
      x: b.x0 + (b.x1 - b.x0) * t + (rnd() - 0.5) * 28,
      y: b.y0 + (b.y1 - b.y0) * t + (rnd() - 0.5) * 22,
    });
  }
  pts.push({ x: b.x1, y: b.y1 });
  const a = Math.max(0, b.life / b.max);
  g.globalCompositeOperation = "lighter";
  g.strokeStyle = `rgba(${b.r},${b.g},${b.b},${a})`;
  g.lineWidth = 2.2;
  g.beginPath();
  g.moveTo(pts[0]!.x, pts[0]!.y);
  for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
  g.stroke();
  g.strokeStyle = `rgba(255,255,255,${a * 0.8})`;
  g.lineWidth = 0.8;
  g.stroke();
}

function frame(now: number) {
  if (!running || !ctx2 || !canvas) return;
  const dt = Math.min(0.033, 1 / 60);
  elapsed += dt;
  const u = Math.min(1, elapsed / duration);
  placeOrigin();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx2.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  if (u < 1) drive(lastU, u, dt);
  lastU = u;

  shake = Math.max(0, shake - dt * 2.8);
  const sx = reduced ? 0 : Math.sin(elapsed * 48) * shake * 7;
  const sy = reduced ? 0 : Math.cos(elapsed * 37) * shake * 5;

  for (const v of vines) v.growth = Math.min(1, v.growth + dt * 1.4);
  if (vines.length && ctx2) {
    ctx2.save();
    ctx2.translate(sx, sy);
    ctx2.globalCompositeOperation = "lighter";
    ctx2.lineWidth = 1.6;
    for (const v of vines) {
      ctx2!.strokeStyle = `rgba(${v.r},${v.g},${v.b},0.85)`;
      ctx2!.beginPath();
      const steps = Math.max(2, Math.floor(v.growth * 16));
      for (let i = 0; i <= steps; i++) {
        const t = i / 16;
        const u1 = 1 - t;
        const x = u1 * u1 * v.ax + 2 * u1 * t * v.bx + t * t * v.cx;
        const y = u1 * u1 * v.ay + 2 * u1 * t * v.by + t * t * v.cy;
        if (i === 0) ctx2!.moveTo(x, y);
        else ctx2!.lineTo(x, y);
      }
      ctx2!.stroke();
    }
    ctx2.restore();
  }

  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i]!;
    r.life -= dt;
    r.radius += r.vr * dt;
    if (r.life <= 0) {
      rings.splice(i, 1);
      continue;
    }
    const a = r.life / r.max;
    ctx2.save();
    ctx2.translate(sx, sy);
    ctx2.globalCompositeOperation = "lighter";
    ctx2.strokeStyle = `rgba(${r.r},${r.g},${r.b},${a * 0.85})`;
    ctx2.lineWidth = r.width;
    ctx2.beginPath();
    ctx2.arc(r.x, r.y, Math.max(1, r.radius), r.rot, r.rot + r.arc);
    ctx2.stroke();
    ctx2.restore();
  }

  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i]!;
    b.life -= dt;
    if (b.life <= 0) {
      bolts.splice(i, 1);
      continue;
    }
    ctx2.save();
    ctx2.translate(sx, sy);
    drawBolt(ctx2, b);
    ctx2.restore();
  }

  for (const p of pool) {
    if (!p.alive) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.alive = false;
      continue;
    }
    p.px = p.x;
    p.py = p.y;
    p.vy += p.grav * dt;
    const drag = Math.exp(-p.drag * dt);
    p.vx *= drag;
    p.vy *= drag;
    if (p.pull) {
      p.vx += (ox - p.x) * dt * 1.4;
      p.vy += (oy - p.y) * dt * 1.4;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.ang += p.spin * dt;
  }

  const drawLayer = (layer: 0 | 1) => {
    ctx2!.save();
    ctx2!.translate(sx, sy);
    ctx2!.globalCompositeOperation = layer === 0 ? "lighter" : "source-over";
    for (const p of pool) {
      if (!p.alive || p.layer !== layer) continue;
      const a = Math.max(0, p.life / p.max);
      const fade = a * a;
      ctx2!.globalAlpha = layer === 0 ? fade : fade * 0.35;
      const img = stamp(p.kind === 1 ? 1 : 0, [p.r, p.g, p.b]);
      const s = p.size * (layer === 1 ? 1.8 : 1) * (0.65 + a);
      ctx2!.translate(p.x, p.y);
      ctx2!.rotate(p.ang);
      ctx2!.drawImage(img, -s, -s, s * 2, s * 2);
      if (p.kind === 2 && layer === 0) {
        ctx2!.rotate(-p.ang);
        ctx2!.strokeStyle = `rgba(${p.r},${p.g},${p.b},${fade})`;
        ctx2!.lineWidth = 1.4;
        ctx2!.beginPath();
        ctx2!.moveTo(0, 0);
        ctx2!.lineTo(p.px - p.x, p.py - p.y);
        ctx2!.stroke();
        ctx2!.rotate(p.ang);
      }
      ctx2!.rotate(-p.ang);
      ctx2!.translate(-p.x, -p.y);
    }
    ctx2!.restore();
  };
  drawLayer(1);
  drawLayer(0);

  if (u > 0.08 && u < 0.96 && spec.title) {
    const title = spec.title;
    ctx2.save();
    ctx2.globalCompositeOperation = "source-over";
    ctx2.font = "600 15px Palatino, Georgia, serif";
    const width = Math.min(canvas.clientWidth - 32, ctx2.measureText(title).width);
    const x = Math.max(16, ox - width / 2);
    const y = Math.min(canvas.clientHeight - 28, oy + Math.min(canvas.clientHeight, 800) * 0.22);
    ctx2.fillStyle = "rgba(14,20,22,0.55)";
    ctx2.fillRect(x - 10, y - 16, width + 20, 26);
    ctx2.fillStyle = "rgba(235,230,214,0.92)";
    ctx2.fillText(title, x, y, canvas.clientWidth - 32);
    ctx2.restore();
  }

  const alive = pool.some((p) => p.alive) || rings.length || bolts.length || vines.some((v) => v.growth < 1);
  if (elapsed < duration + 0.55 && (u < 1 || alive)) {
    raf = requestAnimationFrame(frame);
  } else {
    running = false;
    ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx2.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  }
}

function resetField() {
  for (const p of pool) p.alive = false;
  rings.length = 0;
  bolts.length = 0;
  vines.length = 0;
  spawnAcc = 0;
  shake = 0;
  elapsed = 0;
  lastU = 0;
}

function voice(element: string, motion: string, gain: number) {
  if (reduced || gain <= 0) return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!audio) audio = new Ctx();
    if (audio.state === "suspended") void audio.resume();
    const ac = audio;
    if (!noise) {
      const n = Math.floor(ac.sampleRate * 0.35);
      noise = ac.createBuffer(1, n, ac.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    }
    const t = ac.currentTime;
    const master = ac.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.045 * gain), t + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, t + (motion === "stream" || motion === "brume" ? 0.7 : 0.38));
    master.connect(ac.destination);

    const freq: Record<string, number> = {
      fire: 120, water: 240, ice: 1480, electric: 90, plasma: 320, earth: 58,
      plant: 210, air: 520, metal: 340, light: 660, void: 180, beast: 140,
    };
    const osc = ac.createOscillator();
    const og = ac.createGain();
    osc.type = element === "ice" || element === "light" ? "triangle" : element === "metal" ? "square" : "sine";
    const f0 = freq[element] ?? 180;
    osc.frequency.setValueAtTime(element === "void" ? 240 : f0, t);
    if (element === "void") osc.frequency.exponentialRampToValueAtTime(70, t + 0.4);
    og.gain.value = element === "electric" ? 0.15 : 0.5;
    osc.connect(og);
    og.connect(master);
    osc.start(t);
    osc.stop(t + 0.45);

    const src = ac.createBufferSource();
    src.buffer = noise;
    const filter = ac.createBiquadFilter();
    filter.type = element === "electric" || element === "air" ? "highpass" : element === "earth" || element === "beast" ? "lowpass" : "bandpass";
    filter.frequency.value = element === "ice" ? 2400 : element === "earth" ? 180 : 700;
    filter.Q.value = 0.7;
    const ng = ac.createGain();
    ng.gain.value = element === "light" ? 0.05 : 0.35;
    src.connect(filter);
    filter.connect(ng);
    ng.connect(master);
    src.start(t);
    src.stop(t + 0.4);
  } catch {
    /* the picture still plays */
  }
}

export function stopFx() {
  running = false;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  resetField();
  if (ctx2 && canvas) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx2.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  }
}

export function playFx(next: FxSpec) {
  const g = ensureCanvas();
  if (!g || !canvas) return;
  stopFx();
  spec = next;
  palette = PALETTE[next.element] ?? PALETTE.beast!;
  phys = PHYS[next.element] ?? PHYS.beast!;
  vary = makeVariation(next.seed || 1);
  intensity = Math.max(0.45, Math.min(1.7, next.intensity ?? 1));
  const mass = next.mass ?? "medium";
  const base = mass === "heavy" ? 2.15 : mass === "light" ? 1.25 : 1.65;
  duration = (reduced ? 0.45 : 1) * base * (next.motion === "sting" ? 0.85 : 1);
  placeOrigin();
  if (next.toward) vary.side = 1;
  else aim = -0.2 + vary.tilt;
  running = true;
  voice(next.element, next.motion, reduced ? 0 : intensity);
  raf = requestAnimationFrame(frame);
}
