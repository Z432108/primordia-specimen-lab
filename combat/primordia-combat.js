"use strict";
(() => {
  // primordia-specimen-lab/combat/types.ts
  var ANIMATION_KEYS = [
    "horn_thrust",
    "tentacle_chain_slam",
    "tentacle_whip",
    "breath_stream",
    "breath_cone",
    "breath_burst",
    "claw_arc",
    "tail_swipe",
    "wing_flap",
    "surface_shard",
    "body_charge",
    "organ_activate",
    "relic_use",
    "jaw_snap",
    "act"
  ];

  // primordia-specimen-lab/combat/fx.ts
  var PALETTE = {
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
    beast: { core: [255, 228, 210], mid: [176, 92, 62], edge: [86, 34, 26], smoke: [58, 38, 30], spark: [255, 176, 130] }
  };
  var PHYS = {
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
    beast: { grav: 180, drag: 0.75, smoke: 0.1, bolt: 0, shape: 2 }
  };
  var pool = [];
  for (let i = 0; i < 420; i++) {
    pool.push({
      alive: false,
      layer: 0,
      x: 0,
      y: 0,
      px: 0,
      py: 0,
      vx: 0,
      vy: 0,
      life: 0,
      max: 1,
      size: 1,
      r: 255,
      g: 255,
      b: 255,
      grav: 0,
      drag: 0,
      kind: 0,
      spin: 0,
      ang: 0,
      pull: 0
    });
  }
  var canvas = null;
  var ctx2 = null;
  var soft = null;
  var shard = null;
  var raf = 0;
  var running = false;
  var reduced = false;
  var audio = null;
  var noise = null;
  var spec = { element: "beast", motion: "burst", seed: 1 };
  var palette = PALETTE.beast;
  var phys = PHYS.beast;
  var vary = { rnd: Math.random, spread: 1, spin: 1, echoes: 1, tilt: 0, size: 1, late: false, mix: 0, rate: 1, side: 1 };
  var intensity = 1;
  var duration = 1.6;
  var elapsed = 0;
  var lastU = 0;
  var spawnAcc = 0;
  var shake = 0;
  var ox = 0;
  var oy = 0;
  var aim = 0;
  var rings = [];
  var bolts = [];
  var vines = [];
  function mix(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t)
    ];
  }
  function makeVariation(seed) {
    let s = seed >>> 0 || 1;
    const rnd = () => {
      s = Math.imul(1664525, s) + 1013904223 >>> 0;
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
      side: rnd() < 0.5 ? -1 : 1
    };
  }
  function ensureCanvas() {
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
  function sprite(diamond) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
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
  function tinted(src, rgb) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    g.fillRect(0, 0, 64, 64);
    return c;
  }
  var tintCache = /* @__PURE__ */ new Map();
  function stamp(kind, rgb) {
    const key = `${kind}:${rgb.join(",")}`;
    const hit = tintCache.get(key);
    if (hit) return hit;
    const base = kind === 1 ? shard : soft;
    const painted = tinted(base, rgb);
    tintCache.set(key, painted);
    return painted;
  }
  function spawn(x, y, vx, vy, life, size, rgb, layer, kind, pull = 0) {
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
  function ring(x, y, radius, vr, life, rgb, width, arc = Math.PI * 2) {
    rings.push({ x, y, radius, vr, life, max: life, r: rgb[0], g: rgb[1], b: rgb[2], width, arc, rot: vary.tilt });
  }
  function bolt(x0, y0, x1, y1, life, rgb) {
    bolts.push({ x0, y0, x1, y1, life, max: life, seed: vary.rnd() * 1e9 | 0, r: rgb[0], g: rgb[1], b: rgb[2] });
  }
  function burst(x, y, n, speed, life, rgb, kind) {
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
  function crossed(u0, u1, mark) {
    return u0 < mark && u1 >= mark;
  }
  function forward(dist) {
    return { x: ox + Math.cos(aim) * dist * vary.side, y: oy + Math.sin(aim) * dist * 0.72 };
  }
  function drive(u0, u1, dt) {
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
    const spray = (along, fan, count) => {
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
        const mark = 0.18 + i / n * 0.62;
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
        const mark = 0.08 + i / n * 0.7;
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
      if (crossed(u0, u1, 0.2) || motion === "aegis" && crossed(u0, u1, 0.45)) {
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
          const a = vary.spin * u * 4 + i / n * Math.PI * 2;
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
          const a = i / n * Math.PI * 2 + vary.tilt;
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
        ax: ox,
        ay: oy,
        bx: ox + vary.side * reach * 0.3,
        by: oy - reach * 0.4,
        cx: end.x,
        cy: end.y,
        growth: 0,
        r: palette.mid[0],
        g: palette.mid[1],
        b: palette.mid[2]
      });
    }
  }
  function drawBolt(g, b) {
    const n = 7;
    let seed = b.seed + Math.floor(elapsed * 24);
    const rnd = () => {
      seed = Math.imul(1664525, seed) + 1013904223 >>> 0;
      return seed / 4294967296;
    };
    const pts = [{ x: b.x0, y: b.y0 }];
    for (let i = 1; i < n; i++) {
      const t = i / n;
      pts.push({
        x: b.x0 + (b.x1 - b.x0) * t + (rnd() - 0.5) * 28,
        y: b.y0 + (b.y1 - b.y0) * t + (rnd() - 0.5) * 22
      });
    }
    pts.push({ x: b.x1, y: b.y1 });
    const a = Math.max(0, b.life / b.max);
    g.globalCompositeOperation = "lighter";
    g.strokeStyle = `rgba(${b.r},${b.g},${b.b},${a})`;
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
    g.stroke();
    g.strokeStyle = `rgba(255,255,255,${a * 0.8})`;
    g.lineWidth = 0.8;
    g.stroke();
  }
  function frame(now) {
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
        ctx2.strokeStyle = `rgba(${v.r},${v.g},${v.b},0.85)`;
        ctx2.beginPath();
        const steps = Math.max(2, Math.floor(v.growth * 16));
        for (let i = 0; i <= steps; i++) {
          const t = i / 16;
          const u1 = 1 - t;
          const x = u1 * u1 * v.ax + 2 * u1 * t * v.bx + t * t * v.cx;
          const y = u1 * u1 * v.ay + 2 * u1 * t * v.by + t * t * v.cy;
          if (i === 0) ctx2.moveTo(x, y);
          else ctx2.lineTo(x, y);
        }
        ctx2.stroke();
      }
      ctx2.restore();
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
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
      const b = bolts[i];
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
    const drawLayer = (layer) => {
      ctx2.save();
      ctx2.translate(sx, sy);
      ctx2.globalCompositeOperation = layer === 0 ? "lighter" : "source-over";
      for (const p of pool) {
        if (!p.alive || p.layer !== layer) continue;
        const a = Math.max(0, p.life / p.max);
        const fade = a * a;
        ctx2.globalAlpha = layer === 0 ? fade : fade * 0.35;
        const img = stamp(p.kind === 1 ? 1 : 0, [p.r, p.g, p.b]);
        const s = p.size * (layer === 1 ? 1.8 : 1) * (0.65 + a);
        ctx2.translate(p.x, p.y);
        ctx2.rotate(p.ang);
        ctx2.drawImage(img, -s, -s, s * 2, s * 2);
        if (p.kind === 2 && layer === 0) {
          ctx2.rotate(-p.ang);
          ctx2.strokeStyle = `rgba(${p.r},${p.g},${p.b},${fade})`;
          ctx2.lineWidth = 1.4;
          ctx2.beginPath();
          ctx2.moveTo(0, 0);
          ctx2.lineTo(p.px - p.x, p.py - p.y);
          ctx2.stroke();
          ctx2.rotate(p.ang);
        }
        ctx2.rotate(-p.ang);
        ctx2.translate(-p.x, -p.y);
      }
      ctx2.restore();
    };
    drawLayer(1);
    drawLayer(0);
    if (u > 0.08 && u < 0.96 && spec.title) {
      const title3 = spec.title;
      ctx2.save();
      ctx2.globalCompositeOperation = "source-over";
      ctx2.font = "600 15px Palatino, Georgia, serif";
      const width = Math.min(canvas.clientWidth - 32, ctx2.measureText(title3).width);
      const x = Math.max(16, ox - width / 2);
      const y = Math.min(canvas.clientHeight - 28, oy + Math.min(canvas.clientHeight, 800) * 0.22);
      ctx2.fillStyle = "rgba(14,20,22,0.55)";
      ctx2.fillRect(x - 10, y - 16, width + 20, 26);
      ctx2.fillStyle = "rgba(235,230,214,0.92)";
      ctx2.fillText(title3, x, y, canvas.clientWidth - 32);
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
  function voice(element, motion, gain) {
    if (reduced || gain <= 0) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
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
      master.gain.setValueAtTime(1e-4, t);
      master.gain.exponentialRampToValueAtTime(Math.max(1e-4, 0.045 * gain), t + 0.02);
      master.gain.exponentialRampToValueAtTime(1e-4, t + (motion === "stream" || motion === "brume" ? 0.7 : 0.38));
      master.connect(ac.destination);
      const freq = {
        fire: 120,
        water: 240,
        ice: 1480,
        electric: 90,
        plasma: 320,
        earth: 58,
        plant: 210,
        air: 520,
        metal: 340,
        light: 660,
        void: 180,
        beast: 140
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
    }
  }
  function stopFx() {
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
  function playFx(next) {
    const g = ensureCanvas();
    if (!g || !canvas) return;
    stopFx();
    spec = next;
    palette = PALETTE[next.element] ?? PALETTE.beast;
    phys = PHYS[next.element] ?? PHYS.beast;
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

  // primordia-specimen-lab/combat/animate.ts
  var KNOWN = new Set(ANIMATION_KEYS);
  var ACT_FOR = {
    horn_thrust: ["horn_rub", "head_toss", "rear", "pounce"],
    tentacle_chain_slam: ["tentacle_explore", "sway", "pounce"],
    tentacle_whip: ["tentacle_explore", "shake_off", "head_toss"],
    breath_stream: ["display", "glow_pulse", "yawn", "rear"],
    breath_cone: ["display", "yawn", "glow_pulse", "head_toss"],
    breath_burst: ["glow_pulse", "shake_off", "display", "rear"],
    claw_arc: ["dig", "pounce", "rear", "shake_off"],
    tail_swipe: ["shake_off", "sway", "head_toss", "uncoil"],
    wing_flap: ["wing_stretch", "hover_bob", "preen", "display"],
    surface_shard: ["shake_off", "horn_rub", "display", "wing_stretch"],
    body_charge: ["pounce", "stalk", "rear", "stretch"],
    organ_activate: ["glow_pulse", "pulse", "color_ripple", "display"],
    relic_use: ["raise_relic", "display", "rear", "glow_pulse"],
    jaw_snap: ["yawn", "chew_cud", "flick_tongue", "head_toss"],
    act: ["pounce", "rear", "display", "head_toss"]
  };
  var MOTION_ACTS = {
    thrust: ["head_toss", "horn_rub", "stalk", "pounce", "rear"],
    arc: ["shake_off", "head_toss", "dig", "sway", "pounce"],
    chain: ["tentacle_explore", "sway", "pounce", "uncoil"],
    lash: ["tentacle_explore", "shake_off", "head_toss", "sway"],
    stream: ["display", "glow_pulse", "yawn", "rear"],
    cone: ["display", "yawn", "glow_pulse", "head_toss"],
    burst: ["glow_pulse", "shake_off", "display", "rear"],
    volley: ["shake_off", "horn_rub", "wing_stretch", "display"],
    spiral: ["sway", "uncoil", "glow_pulse", "display"],
    rain: ["shake_off", "wing_stretch", "preen", "display"],
    vortex: ["sway", "coil", "tentacle_explore", "uncoil"],
    wall: ["withdraw", "rear", "coil", "display"],
    pulse: ["glow_pulse", "pulse", "color_ripple", "display"],
    charge: ["pounce", "stalk", "rear", "stretch"],
    sting: ["flick_tongue", "head_toss", "horn_rub", "pounce"],
    bite: ["yawn", "chew_cud", "flick_tongue", "head_toss"],
    sigil: ["glow_pulse", "raise_relic", "display", "color_ripple"],
    wing: ["wing_stretch", "hover_bob", "preen", "display"],
    cyclone: ["sway", "shake_off", "uncoil", "coil"],
    slam: ["rear", "dig", "pounce", "burrow"],
    yank: ["tentacle_explore", "withdraw", "sway", "head_toss"],
    grind: ["chew_cud", "yawn", "dig", "horn_rub"],
    brume: ["display", "glow_pulse", "filter", "drift"],
    knit: ["glow_pulse", "bask", "pulse", "display"]
  };
  var QUIET = /* @__PURE__ */ new Set([
    "sit",
    "lie",
    "rest",
    "look_around",
    "scan",
    "scan_dark",
    "perch_shift",
    "bask",
    "graze",
    "filter",
    "drift",
    "paddle",
    "ear_swivel",
    "antenna_clean",
    "groom",
    "preen"
  ]);
  var STRIKE = [
    "pounce",
    "rear",
    "head_toss",
    "dig",
    "tentacle_explore",
    "wing_stretch",
    "horn_rub",
    "display",
    "shake_off",
    "sway",
    "uncoil",
    "raise_relic",
    "glow_pulse",
    "flick_tongue",
    "yawn",
    "chew_cud",
    "stalk",
    "pulse",
    "color_ripple",
    "hover_bob",
    "coil",
    "burrow",
    "stretch"
  ];
  var GUARD_ACTS = ["withdraw", "coil", "burrow", "rear", "shake_off", "sway", "display", "look_around"];
  function saltRank(salt, id) {
    let h = 2166136261;
    const s = `${salt}:${id}`;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function actsForAttack(animationKey, motion, owned) {
    const key = resolveAnimation(animationKey).key;
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    const push2 = (id) => {
      if (seen.has(id)) return;
      seen.add(id);
      out.push(id);
    };
    for (const id of MOTION_ACTS[motion ?? ""] ?? []) push2(id);
    for (const id of ACT_FOR[key] ?? ACT_FOR.act) push2(id);
    for (const id of STRIKE) push2(id);
    if (owned?.length) {
      const loud = owned.filter((id) => !QUIET.has(id));
      const pool2 = (loud.length ? loud : owned).slice().sort((a, b) => saltRank(`${motion ?? ""}:${key}`, a) - saltRank(`${motion ?? ""}:${key}`, b));
      for (const id of pool2) push2(id);
    }
    return out;
  }
  function resolveAnimation(key) {
    if (KNOWN.has(key)) return { key, fallback: false };
    console.info("combat: missing animation driver", key);
    return { key: "act", fallback: true };
  }
  function ownedIds(anim) {
    try {
      const list = anim.actsAvailable?.();
      return Array.isArray(list) && list.length ? list : null;
    } catch {
      return null;
    }
  }
  function holdFor(anim, id) {
    try {
      if (anim.acts?.play) return Boolean(anim.acts.play(id, true));
      return Boolean(anim.act?.(id));
    } catch {
      return false;
    }
  }
  function playOwnedAct(anim, ids, mass) {
    if (!anim) return null;
    const rate = mass === "heavy" ? 0.55 : mass === "light" ? 1.2 : 0.85;
    try {
      if (!anim.acts) anim.setActs?.({ rate });
      if (anim.acts) anim.acts.rate = rate;
    } catch {
    }
    const owned = ownedIds(anim);
    const seen = /* @__PURE__ */ new Set();
    let act = null;
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      if (owned && !owned.includes(id)) continue;
      if (holdFor(anim, id)) {
        act = id;
        break;
      }
    }
    if (!act) return null;
    const bag = anim.acts;
    const hold = mass === "heavy" ? 1500 : 1200;
    setTimeout(() => {
      try {
        bag?.release?.();
      } catch {
      }
    }, hold);
    return act;
  }
  function playAttack(anim, animationKey, mass, motion) {
    const resolved = resolveAnimation(animationKey);
    if (!anim) {
      console.info("combat: missing animation driver", animationKey);
      return { key: "act", fallback: true, act: null };
    }
    const owned = ownedIds(anim) ?? void 0;
    const tries = actsForAttack(animationKey, motion, owned);
    const act = playOwnedAct(anim, tries, mass);
    if (!act) {
      console.info("combat: missing animation driver", animationKey);
      return { key: "act", fallback: true, act: null };
    }
    if (resolved.key.startsWith("breath") || resolved.key === "organ_activate" || resolved.key === "surface_shard") {
      const flare = mass === "heavy" ? 2.3 : mass === "light" ? 1.35 : 1.7;
      try {
        anim.flare?.(flare);
      } catch {
      }
      const hold = mass === "heavy" ? 980 : 640;
      setTimeout(() => {
        try {
          anim.flare?.(1);
        } catch {
        }
      }, hold);
    }
    return { key: resolved.key, fallback: resolved.fallback, act };
  }
  function performAttack(anim, attack, mass, intensity2 = 1) {
    const played = playAttack(anim, attack.animationKey, mass, attack.fxMotion);
    if (attack.element && attack.fxMotion) {
      playFx({
        element: attack.element,
        motion: attack.fxMotion,
        seed: attack.fxSeed ?? 1,
        mass,
        title: attack.name,
        intensity: intensity2
      });
    }
    return played;
  }

  // primordia-specimen-lab/combat/arena.ts
  var LIFE_STAGES = ["Sprout", "Keen", "Adept", "Apex", "Steward", "Artisan", "Exemplar", "Sovereign"];
  var STAGE_BULK = [0.42, 0.68, 0.88, 1, 1.12, 1.26, 1.4, 1.58];
  function stageBulk(stage) {
    const i = LIFE_STAGES.indexOf(stage);
    return STAGE_BULK[i] ?? 1;
  }
  var STAGE_STAT = {
    Sprout: 0.55,
    Keen: 0.75,
    Adept: 0.92,
    Apex: 1,
    Steward: 1,
    Artisan: 1,
    Exemplar: 1,
    Sovereign: 1
  };
  function scaledPhenotype(ph, fromStage, toStage) {
    const from = stageBulk(fromStage || "Apex");
    const to = stageBulk(toStage);
    const next = { ...ph, sizeM: Math.max(0.12, ph.sizeM * (to / from)) };
    const sheet = ph.stats && Object.values(ph.stats).some((v) => v > 3);
    if (sheet && ph.stats) {
      const ratio = (STAGE_STAT[toStage] ?? 1) / (STAGE_STAT[fromStage] ?? 1);
      const stats = {};
      for (const [key, value] of Object.entries(ph.stats)) {
        stats[key] = Math.max(1, Math.min(100, Math.round(value * ratio)));
      }
      next.stats = stats;
    }
    return next;
  }
  function companionOf(id, name, stage, ph, defense, genomeId) {
    const units = new Set(ph.units.map((u) => u.unit));
    const legUnit = ph.units.find((u) => u.unit === "leg");
    let legs = legUnit?.count ?? 0;
    if (!legs && (ph.plan === "biped" || ph.loco === "BipedWalk")) legs = 2;
    if (!legs && (ph.plan === "quadruped" || ph.plan === "centauroid" || ph.loco === "QuadGait")) legs = 4;
    if (!legs && (ph.plan === "hexapod" || ph.loco === "MultiLegRipple")) legs = 6;
    if (!legs && ph.plan === "octopod") legs = 8;
    const covering = ph.covering?.type || "skin";
    const companion = {
      id,
      name,
      stage: stage || "Apex",
      element: ph.element || "beast",
      sizeM: ph.sizeM,
      maxHp: defense.hp,
      hp: defense.hp,
      horns: units.has("horn"),
      wings: units.has("wing"),
      tail: units.has("tail"),
      legs,
      claws: Boolean(ph.claws) || units.has("claw"),
      fins: units.has("fin"),
      tentacles: units.has("tentacle"),
      shell: Boolean(ph.shell) || covering === "shell" || covering === "plate" || covering === "carapace",
      covering,
      loco: ph.loco || "",
      ecology: ph.ecology || "",
      armor: defense.armor,
      plan: ph.plan || "",
      organ: ph.ascent?.organ || "",
      volant: Boolean(ph.volant),
      spines: units.has("spine") || units.has("quill"),
      mandibles: units.has("mandible"),
      gait: "crawl",
      genomeId
    };
    companion.gait = gaitOf(companion);
    return companion;
  }
  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }
  function coversFor(ecology, elements) {
    const e = ecology.toLowerCase();
    if (/deep_ocean|reef|swamp|aquatic/.test(e)) {
      return [
        { x: 0.5, y: 0.58, r: 0.14, kind: "pool" },
        { x: 0.22, y: 0.42, r: 0.06, kind: "stone" },
        { x: 0.78, y: 0.4, r: 0.06, kind: "stone" }
      ];
    }
    if (/tundra|alpine/.test(e)) {
      return [
        { x: 0.3, y: 0.48, r: 0.07, kind: "ice" },
        { x: 0.62, y: 0.4, r: 0.06, kind: "stone" },
        { x: 0.74, y: 0.66, r: 0.08, kind: "ice" }
      ];
    }
    if (/grassland/.test(e)) {
      return [
        { x: 0.34, y: 0.55, r: 0.09, kind: "dune" },
        { x: 0.68, y: 0.42, r: 0.05, kind: "stone" },
        { x: 0.8, y: 0.7, r: 0.07, kind: "dune" }
      ];
    }
    if (/forest|jungle/.test(e)) {
      return [
        { x: 0.32, y: 0.36, r: 0.05, kind: "tree" },
        { x: 0.68, y: 0.34, r: 0.06, kind: "tree" },
        { x: 0.5, y: 0.7, r: 0.05, kind: "stone" }
      ];
    }
    if (/desert|dune|waste|volcan|ash/.test(e)) {
      return [
        { x: 0.4, y: 0.5, r: 0.1, kind: /volcan|ash/.test(e) ? "vent" : "dune" },
        { x: 0.72, y: 0.62, r: 0.08, kind: "dune" },
        { x: 0.18, y: 0.4, r: 0.045, kind: "stone" }
      ];
    }
    if (/cave|under/.test(e)) {
      return [
        { x: 0.28, y: 0.46, r: 0.07, kind: "stone" },
        { x: 0.55, y: 0.58, r: 0.08, kind: "stone" },
        { x: 0.78, y: 0.42, r: 0.06, kind: "stone" }
      ];
    }
    if (/celestial|void/.test(e)) {
      return [
        { x: 0.3, y: 0.46, r: 0.05, kind: "vent" },
        { x: 0.62, y: 0.4, r: 0.06, kind: "stone" },
        { x: 0.74, y: 0.68, r: 0.05, kind: "vent" }
      ];
    }
    const out = [];
    const el2 = elements.toLowerCase();
    if (/water|ice/.test(el2)) out.push({ x: 0.5, y: 0.58, r: 0.12, kind: /ice/.test(el2) && !/water/.test(el2) ? "ice" : "pool" });
    if (/plant|beast/.test(el2)) out.push({ x: 0.28, y: 0.4, r: 0.05, kind: "tree" });
    if (/earth|metal/.test(el2)) out.push({ x: 0.7, y: 0.5, r: 0.06, kind: "stone" });
    if (/fire|plasma|void|light|electric/.test(el2)) out.push({ x: 0.62, y: 0.42, r: 0.05, kind: "vent" });
    if (/air/.test(el2)) out.push({ x: 0.4, y: 0.7, r: 0.08, kind: "dune" });
    const spare = ["stone", "dune", "tree"];
    let n = 0;
    while (out.length < 3) out.push({ x: 0.22 + out.length * 0.24, y: 0.5, r: 0.05, kind: spare[n++ % spare.length] });
    return out.slice(0, 4);
  }
  function gaitOf(c) {
    const plan = c.plan;
    const loco = c.loco;
    if (loco === "Sessile" || plan === "sessile_mass" || plan === "sessile_radial") return "rooted";
    if (loco === "Swim" || plan === "swimmer" || plan === "aquatic_stand" && c.fins) return "swim";
    if (plan === "aquatic_stand") return "stride";
    if (loco === "Hover" || plan === "floater" || c.organ === "levitator" || c.organ === "sails") return c.wings ? "fly" : "hover";
    if (c.volant && c.wings) return "fly";
    if (c.volant && c.legs === 0) return "hover";
    if (c.wings && c.legs === 0) return "fly";
    if (loco === "Slither" || plan === "serpentine" || plan === "segmented_serpent") return "slither";
    if (plan === "radial") return "radial";
    if (plan === "blob" || plan === "amorphous" || c.covering === "slime" && c.legs === 0 && !c.fins) return "ooze";
    if (plan === "worm" || loco === "Crawl") return "crawl";
    if (loco === "MultiLegRipple" || plan === "hexapod" || plan === "octopod" || c.legs >= 6) return "scuttle";
    if (loco === "QuadGait" || plan === "quadruped" || plan === "centauroid" || c.legs === 4) return "gallop";
    if (loco === "BipedWalk" || plan === "biped" || c.legs === 2) return "stride";
    if (c.fins) return "swim";
    if (c.wings) return "fly";
    if (c.legs === 0) return c.covering === "slime" ? "ooze" : "crawl";
    return "stride";
  }
  function nearest(covers, x, y) {
    let best = covers[0];
    let d = Infinity;
    for (const c of covers) {
      const dd = (c.x - x) ** 2 + (c.y - y) ** 2;
      if (dd < d) {
        d = dd;
        best = c;
      }
    }
    return best;
  }
  function beside(cover, fromX) {
    const side = fromX < cover.x ? -1 : 1;
    return { x: clamp(cover.x + side * (cover.r + 0.09), 0.08, 0.92), y: clamp(cover.y + 0.04, 0.34, 0.86) };
  }
  function partWord(c, key) {
    if (/wing/.test(key) && c.wings) return "the wings";
    if (/horn/.test(key) && c.horns) return "the horns";
    if (/tail|sting/.test(key) && c.tail) return "the tail";
    if (/claw|rake/.test(key) && c.claws) return "the claws";
    if (/tentacle|whip/.test(key) && c.tentacles) return "the reach";
    if (/fin/.test(key) && c.fins) return "the fins";
    if (/spine|shard|spike|volley|barrage/.test(key)) return "the hide";
    if (/mandible/.test(key) && c.mandibles) return "the jaws";
    if (/bite|jaw|fang/.test(key)) return "the mouth";
    if (/breath|cone|stream|burst/.test(key)) return "the breath";
    if (/organ/.test(key) && c.organ) return `the ${c.organ}`;
    if (/relic/.test(key)) return "the relic";
    if (c.horns) return "the horns";
    if (c.claws) return "the claws";
    if (c.tail) return "the tail";
    if (c.tentacles) return "the reach";
    if (c.fins) return "the fins";
    if (c.wings) return "the wings";
    if (c.spines) return "the hide";
    if (c.shell) return "the shell";
    return "the body";
  }
  function placeWord(kind) {
    if (kind === "pool") return "the water";
    if (kind === "tree") return "the trunk";
    if (kind === "vent") return "the vent";
    if (kind === "dune") return "the dune";
    if (kind === "ice") return "the ice";
    return "the stone";
  }
  function ranged(key) {
    return /breath|shard|spine|spike|burst|cone|stream|organ|relic|dual|volley|barrage/.test(key);
  }
  function chooseLine(a, d, attackId, key, covers, ax0, ay0, dx0, dy0) {
    const gait = a.gait || gaitOf(a);
    const dg = d.gait || gaitOf(d);
    const part = partWord(a, key);
    const cover = nearest(covers, (ax0 + dx0) / 2, (ay0 + dy0) / 2);
    const place = placeWord(cover.kind);
    const gap = ranged(key) ? 0.28 : 0.15;
    const dir = dx0 - ax0 < 0 ? -1 : 1;
    let ax = dx0 - dir * gap;
    let ay = dy0;
    let az = 0;
    let dx = dx0;
    let dy = dy0;
    let dz = 0;
    let verb = `comes in with ${part}`;
    if (attackId === "knit") {
      return { ax: ax0, ay: ay0, az: 0, dx: dx0, dy: dy0, dz: 0, note: `${a.name} knits where it stands.` };
    }
    if (attackId === "dot") {
      return { ax: ax0, ay: ay0, az: 0, dx: dx0, dy: dy0, dz: 0, note: `${d.name} is held by what was left in the ground.` };
    }
    if (gait === "rooted") {
      ax = ax0;
      ay = ay0;
      verb = `holds the ground and draws them in with ${part}`;
    } else if (gait === "ooze") {
      ax = dx0 - dir * 0.1;
      ay = dy0 + 0.02;
      az = -0.04;
      verb = `spreads across the ground and reaches with ${part}`;
    } else if (gait === "radial") {
      ax = (ax0 + dx0) / 2;
      ay = (ay0 + dy0) / 2;
      verb = `turns in place and strikes outward with ${part}`;
    } else if (gait === "slither") {
      const flank = beside(cover, dx0);
      ax = flank.x;
      ay = flank.y;
      verb = `winds around ${place} and brings ${part}`;
    } else if (gait === "crawl") {
      const flank = beside(cover, ax0);
      ax = flank.x;
      ay = flank.y;
      az = -0.02;
      verb = `keeps to the ground and comes around ${place} with ${part}`;
    } else if (gait === "scuttle") {
      ax = dx0 - dir * gap;
      ay = dy0;
      az = 0.22;
      verb = `goes over ${place} and brings ${part}`;
    } else if (gait === "gallop") {
      const flank = beside(cover, ax0);
      ax = dx0 - dir * gap;
      ay = flank.y;
      verb = `takes the long way around ${place} and charges with ${part}`;
    } else if (gait === "swim") {
      const pool2 = covers.find((c) => c.kind === "pool" || c.kind === "ice");
      if (pool2) {
        const side = ax0 < pool2.x ? -1 : 1;
        ax = pool2.x + side * (pool2.r + 0.02);
        ay = pool2.y;
        az = 0.02;
        verb = `strikes out of ${placeWord(pool2.kind)} with ${part}`;
      } else {
        ax = dx0 - dir * gap;
        verb = `drives in low with ${part}`;
      }
    } else if (gait === "fly") {
      ax = dx0 - dir * 0.12;
      ay = dy0 - 0.04;
      az = 0.72;
      verb = `takes the air over ${place} and comes down with ${part}`;
    } else if (gait === "hover") {
      ax = dx0 - dir * (ranged(key) ? 0.3 : 0.16);
      ay = dy0 - 0.06;
      az = 0.55;
      verb = `hangs over ${place} and reaches with ${part}`;
    } else {
      ax = dx0 - dir * (ranged(key) ? 0.3 : gap);
      verb = ranged(key) ? `stands off and uses ${part}` : `steps in with ${part}`;
    }
    const canBurrow = gait !== "fly" && gait !== "hover" && gait !== "swim" && gait !== "rooted";
    if (canBurrow && (/dig|burrow/.test(key) || (a.element === "earth" && /slam|charge/.test(key) || a.covering === "bark" && gait === "crawl") && !ranged(key))) {
      ax = dx0 - dir * 0.08;
      ay = dy0;
      az = -0.35;
      verb = `goes into the ground and comes up under them with ${part}`;
    }
    if (dg === "rooted") {
      dx = dx0;
      dy = dy0;
      dz = 0;
    } else if (d.shell || d.armor > 0.34 || ["plate", "chitin", "scale", "shell"].includes(d.covering)) {
      const spot = beside(nearest(covers, dx0, dy0), ax);
      dx = spot.x;
      dy = spot.y;
    } else if (dg === "ooze" || d.covering === "slime") {
      dx = clamp(dx0 + 0.14, 0.08, 0.92);
      dy = clamp(dy0 - 0.08, 0.34, 0.86);
    } else if (dg === "fly" || dg === "hover") {
      dx = clamp(dx0 + dir * 0.08, 0.08, 0.92);
      dz = 0.4;
    } else if (d.covering === "bark") {
      dx = dx0;
      dy = dy0;
      dz = -0.05;
    } else if (d.sizeM < 1.1 || dg === "slither" || dg === "crawl") {
      const spot = beside(nearest(covers, dx0, dy0), ax0);
      dx = spot.x;
      dy = spot.y;
    } else {
      dx = clamp(dx0 - dir * 0.06, 0.08, 0.92);
      dy = clamp(dy0 + 0.06, 0.34, 0.86);
    }
    let defend = "";
    if (gait === "rooted" && dg !== "rooted" && !(d.shell || d.armor > 0.4)) {
      dx = ax0 + dir * 0.18;
      dy = ay0;
      dz = 0;
      defend = `${d.name} is drawn in.`;
    } else if (dg === "rooted") defend = `${d.name} cannot leave the ground.`;
    else if (d.shell || d.armor > 0.34 || ["plate", "chitin", "scale", "shell"].includes(d.covering)) defend = `${d.name} puts ${placeWord(nearest(covers, dx, dy).kind)} between them.`;
    else if (dg === "ooze" || d.covering === "slime") defend = `${d.name} slides out of the line.`;
    else if (dg === "fly" || dg === "hover") defend = `${d.name} lifts clear.`;
    else if (d.covering === "bark") defend = `${d.name} roots.`;
    else if (d.sizeM < 1.1 || dg === "slither" || dg === "crawl") defend = `${d.name} gives ground around ${place}.`;
    else defend = `${d.name} turns to meet it.`;
    return { ax, ay, az, dx, dy, dz, note: `${a.name} ${verb}. ${defend}` };
  }
  var ELEMENT_COLOR = {
    fire: 16742948,
    water: 3710162,
    ice: 11592436,
    electric: 7265535,
    plasma: 16740050,
    earth: 9067568,
    plant: 5154868,
    air: 13690094,
    metal: 12239564,
    light: 16765038,
    void: 7219370,
    beast: 11557950
  };
  function duelApi() {
    return window.__lab?.duel ?? null;
  }
  function labCtx() {
    return window.__lab?.ctx ?? null;
  }
  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function reachOf(fig) {
    const b = fig?.build;
    if (b?.min && b?.max) {
      const wide = Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]);
      return Math.max(0.08, wide * 0.46);
    }
    return Math.max(0.16, (fig?.ph?.sizeM ?? 0.8) * 0.32);
  }
  function hullOf(min, max, sizeM = 0.8) {
    if (min && max && min.length >= 3 && max.length >= 3) {
      return {
        across: Math.max(0.05, (max[0] - min[0]) * 0.5),
        tall: Math.max(0.05, max[1] - min[1]),
        along: Math.max(0.05, (max[2] - min[2]) * 0.5)
      };
    }
    const s = Math.max(0.12, sizeM);
    return { across: s * 0.18, tall: s * 0.55, along: s * 0.28 };
  }
  function supportRadius(hull, yaw, dirX, dirZ) {
    const len = Math.hypot(dirX, dirZ);
    if (len < 1e-6) return Math.max(hull.along, hull.across);
    const dx = dirX / len;
    const dz = dirZ / len;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    return Math.sqrt(hull.across * lx * (hull.across * lx) + hull.along * lz * (hull.along * lz));
  }
  function touchDistance(a, aYaw, ax, az, b, bYaw, bx, bz, weapon = 0) {
    const dx = bx - ax;
    const dz = bz - az;
    return supportRadius(a, aYaw, dx, dz) + supportRadius(b, bYaw, -dx, -dz) + Math.max(0, weapon);
  }
  function bodyLen(fig) {
    const b = fig.build;
    if (b?.min && b?.max) {
      return Math.max(0.12, b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]);
    }
    return Math.max(0.12, fig.ph?.sizeM ?? 0.6);
  }
  function footOf(fig) {
    const minY = fig.build?.min?.[1] ?? 0;
    return minY < 0 ? -minY : 0;
  }
  function planted(fig) {
    const root = fig?.view?.root;
    return Boolean(root && root.parent);
  }
  function propKind(ecology) {
    const e = ecology.toLowerCase();
    if (/deep_ocean|reef|swamp/.test(e)) return "pool";
    if (/tundra|alpine/.test(e)) return "ice";
    if (/desert|volcan/.test(e)) return "dune";
    if (/forest|grass|jungle/.test(e)) return "tree";
    if (/cave/.test(e)) return "stone";
    return "stone";
  }
  function habitatCovers(api, span, ecology, elements) {
    const kind = propKind(ecology);
    const covers = [];
    for (const mark of api.landmarks()) {
      const nx = 0.5 + mark.x / span;
      const ny = 0.6 + mark.z / span;
      if (nx < 0.02 || nx > 0.98 || ny < 0.22 || ny > 0.96) continue;
      covers.push({
        x: clamp(nx, 0.08, 0.92),
        y: clamp(ny, 0.3, 0.9),
        r: clamp(mark.r / span, 0.045, 0.16),
        kind
      });
      if (covers.length >= 5) break;
    }
    return covers.length >= 2 ? covers : coversFor(ecology, elements);
  }
  function desiredMotion(gait, moving, airborne) {
    if (gait === "swim") return moving || airborne ? "swim" : "idle";
    if (gait === "fly" || gait === "hover" || airborne) return "fly";
    if (gait === "rooted" || !moving) return "idle";
    return "walk";
  }
  function paceOf(gait, length, rushing) {
    if (gait === "rooted") return 0;
    const body = Math.max(0.18, length);
    let lengths = rushing ? 2.7 : 1.35;
    if (gait === "ooze") lengths *= 0.42;
    else if (gait === "slither" || gait === "crawl" || gait === "radial") lengths *= 0.75;
    else if (gait === "fly" || gait === "hover" || gait === "gallop") lengths *= 1.22;
    else if (gait === "swim") lengths *= 0.92;
    return body * lengths;
  }
  function gaze(x, y, z) {
    return {
      x,
      y,
      z,
      clone() {
        return gaze(this.x, this.y, this.z);
      }
    };
  }
  function ensureDuelStyle() {
    let style = document.getElementById("primordia-duel-style");
    if (style?.textContent?.includes("primordia-pop")) return;
    if (!style) {
      style = document.createElement("style");
      style.id = "primordia-duel-style";
      document.head.append(style);
    }
    style.textContent = `
#app.duel-on .hud, #app.duel-on .toolbar, #app.duel-on .rail-toggle, #app.duel-on .loading { opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }
#primordia-fight { position: absolute; left: 0; right: 0; bottom: 0; z-index: 8; display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1.4fr) minmax(0,1fr); gap: 14px; align-items: end; padding: 42px 18px calc(18px + env(safe-area-inset-bottom)); pointer-events: none; color: #f4f7f4; font-family: Georgia, "Iowan Old Style", serif; text-shadow: 0 1px 2px #000; background: linear-gradient(transparent, rgba(8,12,14,.42) 30%, rgba(8,12,14,.78)); }
#primordia-fight div { display: grid; gap: 5px; }
#primordia-fight div:last-child { justify-items: end; text-align: right; }
#primordia-fight b { font-weight: 500; font-size: 16px; letter-spacing: .01em; }
#primordia-fight small { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 10px; letter-spacing: .16em; text-transform: uppercase; opacity: .78; }
#primordia-fight .track { display: block; height: 7px; width: min(100%, 210px); border-radius: 99px; background: rgba(255,255,255,.16); overflow: hidden; box-shadow: inset 0 0 0 1px rgba(0,0,0,.35); }
#primordia-fight i { display: block; height: 100%; width: 100%; border-radius: 99px; transform-origin: left center; box-shadow: 0 0 10px color-mix(in srgb, currentColor 70%, transparent); transition: filter .15s linear; }
#primordia-fight div:last-child i { transform-origin: right center; }
#primordia-fight i.flash { filter: brightness(3); }
#primordia-fight p { margin: 0 0 6px; text-align: center; font-size: 18px; line-height: 1.3; }
#primordia-fight.hurt-l b { text-shadow: 0 0 14px currentColor, 0 1px 2px #000; }
#primordia-fight.hurt-r div:last-child b { text-shadow: 0 0 14px currentColor, 0 1px 2px #000; }
#primordia-veil { position: absolute; inset: 0; z-index: 4; pointer-events: none; opacity: 0; transition: opacity .5s ease; background: radial-gradient(ellipse at 50% 62%, var(--hit, transparent), transparent 62%); }
#primordia-veil.on { opacity: .62; transition: none; }
#primordia-chip { position: absolute; z-index: 9; margin: 0; font: 600 32px Georgia, "Iowan Old Style", serif; pointer-events: none; text-shadow: 0 2px 10px #000, 0 0 16px currentColor; opacity: 0; }
#primordia-pop { position: absolute; z-index: 9; width: 0; height: 0; pointer-events: none; }
#primordia-pop i { position: absolute; left: -48px; top: -48px; width: 96px; height: 96px; border-radius: 50%; border: 3px solid var(--hit, #fff); box-shadow: 0 0 22px var(--hit, #fff), inset 0 0 16px var(--hit, #fff); opacity: 0; }
#primordia-pop.on i { animation: primordia-ring .6s ease-out; }
#primordia-pop b { position: absolute; left: 18px; top: -14px; font: 600 36px Georgia, "Iowan Old Style", serif; color: #fff; -webkit-text-stroke: 0; text-shadow: 0 2px 8px #000, 0 0 18px var(--hit, #fff); white-space: nowrap; opacity: 0; }
#primordia-pop.on b { animation: primordia-num .9s ease-out; }
@keyframes primordia-ring { from { transform: scale(.3); opacity: 1; } to { transform: scale(1.45); opacity: 0; } }
@keyframes primordia-num { 0% { transform: translateY(6px); opacity: 0; } 18% { opacity: 1; } 100% { transform: translateY(-42px); opacity: 0; } }
`;
  }
  function openBattle(left, right) {
    const app = document.getElementById("app") ?? document.body;
    const stage = window.__lab?.stage;
    const layout = window.__lab?.layout;
    const wasImmersive = Boolean(layout?.immersive);
    const wasSpinning = Boolean(stage?.controls?.autoRotate);
    const keepInsets = stage?.setInsets;
    if (stage && keepInsets) {
      stage.setInsets = () => {
        if (stage.insets) {
          stage.insets.top = 0;
          stage.insets.bottom = 0;
          stage.insets.left = 0;
          stage.insets.right = 0;
        }
        stage.camera?.clearViewOffset?.();
        stage.activeCamera?.clearViewOffset?.();
      };
    }
    if (layout?.setImmersive) {
      try {
        layout.setImmersive(true);
      } catch {
      }
    }
    try {
      stage?.setAutoRotate?.(false);
    } catch {
    }
    if (stage?.controls) {
      stage.controls.minDistance = 0.05;
      stage.controls.maxDistance = 80;
    }
    app.classList.add("duel-on");
    ensureDuelStyle();
    let hpL = left.maxHp;
    let hpR = right.maxHp;
    const strip = document.createElement("div");
    strip.id = "primordia-fight";
    const nameL = document.createElement("b");
    const nameR = document.createElement("b");
    const metaL = document.createElement("small");
    const metaR = document.createElement("small");
    const trackL = document.createElement("span");
    const trackR = document.createElement("span");
    trackL.className = "track";
    trackR.className = "track";
    const barL = document.createElement("i");
    const barR = document.createElement("i");
    const line = document.createElement("p");
    const sideL = document.createElement("div");
    const sideR = document.createElement("div");
    trackL.append(barL);
    trackR.append(barR);
    sideL.append(nameL, metaL, trackL);
    sideR.append(nameR, metaR, trackR);
    strip.append(sideL, line, sideR);
    const veil = document.createElement("div");
    veil.id = "primordia-veil";
    const tint = (element) => `#${(ELEMENT_COLOR[element] ?? 11557950).toString(16).padStart(6, "0")}`;
    const rgba = (element, a) => {
      const n = ELEMENT_COLOR[element] ?? 11557950;
      return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
    };
    nameL.style.color = tint(left.element);
    nameR.style.color = tint(right.element);
    barL.style.background = tint(left.element);
    barR.style.background = tint(right.element);
    barL.style.color = tint(left.element);
    barR.style.color = tint(right.element);
    app.append(veil, strip);
    const chip = document.createElement("b");
    chip.id = "primordia-chip";
    app.append(chip);
    const pop = document.createElement("div");
    pop.id = "primordia-pop";
    const popRing = document.createElement("i");
    const popNum = document.createElement("b");
    pop.append(popRing, popNum);
    app.append(pop);
    const paint2 = (text2) => {
      nameL.textContent = left.name;
      nameR.textContent = right.name;
      metaL.textContent = `${left.stage} \xB7 ${left.element}`;
      metaR.textContent = `${right.stage} \xB7 ${right.element}`;
      barL.style.transform = `scaleX(${Math.max(0, Math.min(1, hpL / left.maxHp))})`;
      barR.style.transform = `scaleX(${Math.max(0, Math.min(1, hpR / right.maxHp))})`;
      line.textContent = text2;
    };
    paint2("Both are taking their places.");
    let span = 3.2;
    let covers = coversFor(`${left.ecology} ${right.ecology}`, `${left.element} ${right.element}`);
    const slots = [];
    const stones = [];
    const guests = [];
    let heroFig = null;
    let heroHidden = false;
    let heroHome = null;
    let running2 = false;
    let closed = false;
    let raf2 = 0;
    let orbitSideX = 0;
    let orbitSideZ = 1;
    let lastTick = performance.now();
    let shake2 = 0;
    let drama = 0;
    let punch = 0;
    let homeFov;
    let userUntil = 0;
    let pointerDown = false;
    let settle = () => {
    };
    const ready = new Promise((resolve) => {
      settle = resolve;
    });
    const aimCamera = () => {
      const cam = stage?.activeCamera || stage?.camera;
      const controls = stage?.controls;
      if (!cam || !controls || slots.length < 2) return;
      if (pointerDown || performance.now() < userUntil) return;
      controls.minDistance = 0.02;
      controls.maxDistance = 200;
      const a = slots[0];
      const b = slots[1];
      const ah = Math.max(0.12, (a.fig.build?.max?.[1] ?? a.fig.ph?.sizeM ?? 0.4) * 0.55);
      const bh = Math.max(0.12, (b.fig.build?.max?.[1] ?? b.fig.ph?.sizeM ?? 0.4) * 0.55);
      const mx = (a.x + b.x) / 2;
      const mz = (a.z + b.z) / 2;
      const my = (a.foot + b.foot) / 2 + Math.min(ah, bh) * 0.55;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      let px = -dz;
      let pz = dx;
      const pl = Math.hypot(px, pz);
      if (pl > 1e-4) {
        px /= pl;
        pz /= pl;
        if (px * orbitSideX + pz * orbitSideZ < 0) {
          px = -px;
          pz = -pz;
        }
        orbitSideX += (px - orbitSideX) * 0.07;
        orbitSideZ += (pz - orbitSideZ) * 0.07;
        const sl = Math.hypot(orbitSideX, orbitSideZ) || 1;
        orbitSideX /= sl;
        orbitSideZ /= sl;
      }
      const sep = Math.max(0.16, Math.hypot(dx, dz));
      const bulk = Math.max(bodyLen(a.fig), bodyLen(b.fig), 0.22);
      const striking = slots.some((s) => s.rush > performance.now());
      const canvas2 = document.querySelector("canvas");
      const aspect = canvas2 && canvas2.clientHeight > 40 ? canvas2.clientWidth / canvas2.clientHeight : cam.aspect || 1.5;
      const fov = cam.fov && cam.fov > 8 ? cam.fov : 32;
      const halfW = Math.tan(fov * Math.PI / 360) * Math.max(0.42, aspect);
      const halfSpan = Math.max(0.2, sep * 0.5 + bulk * 0.42);
      let dist = halfSpan / halfW / (aspect < 0.92 ? 0.9 : 0.78);
      dist = Math.max(dist, bulk * 1.7, 0.85);
      if (striking) dist *= 0.88;
      const lift = dist * (aspect < 0.92 ? 0.22 : striking ? 0.2 : 0.26) + (striking ? drama : 0);
      const jx = (Math.random() - 0.5) * shake2;
      const jz = (Math.random() - 0.5) * shake2;
      try {
        cam.clearViewOffset?.();
      } catch {
      }
      cam.position.set(mx + orbitSideX * dist + jx, my + lift, mz + orbitSideZ * dist + jz);
      controls.target.set(mx, my, mz);
      shake2 *= 0.86;
    };
    const hull = (s) => hullOf(s.fig.build?.min, s.fig.build?.max, s.fig.ph?.sizeM ?? 0.8);
    const centers = (a, b, weapon) => touchDistance(hull(a), a.root.rotation.y, a.x, a.z, hull(b), b.root.rotation.y, b.x, b.z, weapon);
    const strikeOf = (motion, key) => {
      const m = motion || "";
      const tail = /tail|cyclone/.test(`${m} ${key}`);
      const far = /stream|cone|spiral|brume|volley|rain|sigil/.test(m) || /breath_|shard|volley|barrage|organ|dual/.test(key);
      const base = (extra) => ({
        ranged: false,
        gap: 0.96,
        weapon: 0.22,
        lift: 0,
        flank: 0,
        lunge: 0.2,
        rear: tail,
        ...extra
      });
      if (m === "arc" || m === "cyclone" || m === "grind") return base({ gap: 1.02, weapon: tail ? 0.7 : 0.42, flank: m === "grind" ? 0.15 : 0.8, lunge: 0.16, rear: tail || m === "cyclone" });
      if (m === "slam") return base({ gap: 0.92, weapon: 0.12, lift: 0.42, lunge: 0.08, rear: false });
      if (m === "charge") return base({ gap: 0.9, weapon: 0.18, lift: 0.04, lunge: 0.62, rear: false });
      if (m === "bite") return base({ gap: 0.86, weapon: 0.12, lunge: 0.22, rear: false });
      if (m === "sting" || m === "thrust") return base({ gap: 0.96, weapon: m === "sting" && tail ? 0.75 : m === "sting" ? 0.55 : 0.4, lunge: 0.38 });
      if (m === "chain" || m === "lash" || m === "yank") return base({ gap: m === "yank" ? 1.2 : 1.08, weapon: 0.75, flank: m === "lash" ? 0.45 : 0.1, lunge: 0.08, rear: false });
      if (m === "wing") return base({ gap: 1.12, weapon: 0.28, lift: 0.5, flank: 0.65, lunge: 0.1, rear: false });
      if (m === "burst" || m === "pulse" || m === "wall") return base({ ranged: far && m !== "burst", gap: 1.18, weapon: 0.05, lift: 0.08, lunge: 0.06, rear: /shard|spine/.test(key) });
      if (far || m === "stream" || m === "cone" || m === "volley" || m === "rain" || m === "spiral" || m === "brume" || m === "sigil") {
        return base({ ranged: true, gap: 1.5, weapon: 0, lift: m === "rain" || /shard|spine|wing/.test(key) ? 0.35 : 0, rear: /shard|spine|tail/.test(key), lunge: 0.04 });
      }
      return base({ ranged: ranged(key), gap: ranged(key) ? 1.45 : 0.96, weapon: ranged(key) ? 0 : 0.22 });
    };
    const drive2 = (s, other, dt) => {
      if (s.pose < performance.now() && s.rush < performance.now()) s.press = 0;
      if (other && s.gait !== "rooted" && s.rush < performance.now()) {
        const gap = Math.hypot(s.tx - s.x, s.tz - s.z);
        if (gap < 0.07) {
          const ang = Math.atan2(s.z - other.z, s.x - other.x);
          const turn = (s === slots[0] ? 0.85 : -0.85) * dt;
          const rad = Math.max(0.2, centers(s, other, 0) * 1.08);
          const na = ang + turn;
          s.tx = other.x + Math.cos(na) * rad;
          s.tz = other.z + Math.sin(na) * rad;
          s.ty = s.foot + (s.gait === "fly" || s.gait === "hover" ? bodyLen(s.fig) * 0.55 : s.gait === "swim" ? bodyLen(s.fig) * 0.2 : 0);
        }
      }
      const toX = s.tx - s.x;
      const toZ = s.tz - s.z;
      const dist = Math.hypot(toX, toZ);
      const rushing = s.rush > performance.now() || dist > reachOf(s.fig) * 1.4;
      const speed = paceOf(s.gait, bodyLen(s.fig), rushing);
      const step = Math.min(dist, speed * dt);
      let vx = 0;
      let vz = 0;
      if (dist > 1e-4 && step > 0) {
        vx = toX / dist * step;
        vz = toZ / dist * step;
        s.x += vx;
        s.z += vz;
        vx /= Math.max(dt, 1e-4);
        vz /= Math.max(dt, 1e-4);
      }
      s.y += (s.ty - s.y) * Math.min(1, dt * 2.6);
      s.lunge *= Math.exp(-dt * 7);
      if (other) {
        const fdx = other.x - s.x;
        const fdz = other.z - s.z;
        if (fdx * fdx + fdz * fdz > 1e-6) {
          const want = Math.atan2(fdx, fdz);
          s.root.rotation.y = want;
          try {
            s.anim?.setTurn?.(0);
          } catch {
          }
        }
      }
      const ry = s.root.rotation.y;
      s.root.position.set(s.x + Math.sin(ry) * s.lunge, s.y, s.z + Math.cos(ry) * s.lunge);
      const moving = step > 5e-4 || Math.abs(s.lunge) > 0.03;
      const airborne = s.y - s.foot > 0.22 || s.gait === "fly" || s.gait === "hover";
      const motion = desiredMotion(s.gait, moving, airborne);
      const posing = s.pose > performance.now();
      try {
        if (!posing && motion !== s.motion) {
          s.motion = motion;
          if (motion === "fly" && s.anim?.takeoff) s.anim.takeoff();
          else s.anim?.setMotion?.(motion);
        }
        if (!posing) {
          if (motion === "idle") s.anim?.setSpeed?.(0);
          else s.anim?.setSpeed?.(Math.max(speed, motion === "fly" || motion === "swim" ? bodyLen(s.fig) * 0.35 : 0));
          const cos = Math.cos(ry);
          const sin = Math.sin(ry);
          const lx = vx * cos - vz * sin;
          const lz = vx * sin + vz * cos;
          if (Math.hypot(lx, lz) > 0.15) s.anim?.setStepDir?.(lx, lz);
          else s.anim?.setStepDir?.(0, 1);
        }
        if (s.gait === "swim") s.anim?.setWind?.({ x: 0, y: 0, z: 1 }, 0.25, true);
        if (other) {
          const h = Math.max(0.12, (other.fig.build?.max?.[1] ?? bodyLen(other.fig)) * 0.55);
          const gazeAt = gaze(other.x, other.y + h, other.z);
          s.anim?.setAttention?.(gazeAt);
          s.anim?.lookAt?.(gazeAt);
        }
      } catch {
      }
    };
    const marks = [null, null];
    const layMark = (s, element) => {
      const mesh = duelApi()?.stone(s.x, s.z, 0.42);
      if (!mesh?.scale?.set) return null;
      const color = ELEMENT_COLOR[element] ?? ELEMENT_COLOR.beast;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.material?.color?.set?.(color);
      mesh.material?.emissive?.set?.(color);
      if (mesh.material) {
        mesh.material.emissiveIntensity = 0.85;
        mesh.material.roughness = 0.32;
        mesh.material.metalness = 0.06;
      }
      mesh.position.y = 0.03;
      return { mesh, glow: 0.4 };
    };
    const tick = () => {
      if (!running2) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTick) / 1e3);
      lastTick = now;
      const live = slots.filter((s) => s.root.parent);
      if (live.length < slots.length) {
        paint2("The ground shifted under them.");
        running2 = false;
        return;
      }
      for (let i = 0; i < slots.length; i++) drive2(slots[i], slots[1 - i], dt);
      if (slots.length >= 2) {
        const a = slots[0];
        const b = slots[1];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dz) || 1e-3;
        const bodies = centers(a, b, 0);
        const allowed = a.press > 0 || b.press > 0 ? Math.min(a.press || bodies, b.press || bodies) : bodies * 0.92;
        if (dist < allowed) {
          const ux = dx / dist;
          const uz = dz / dist;
          const need = allowed - dist;
          const shove = (s, sign, amount) => {
            if (s.gait === "rooted" || amount === 0) return;
            s.x += ux * amount * sign;
            s.z += uz * amount * sign;
            s.tx += ux * amount * sign;
            s.tz += uz * amount * sign;
            const ry = s.root.rotation.y;
            s.root.position.set(s.x + Math.sin(ry) * s.lunge, s.y, s.z + Math.cos(ry) * s.lunge);
          };
          if (a.gait === "rooted") shove(b, 1, need);
          else if (b.gait === "rooted") shove(a, -1, need);
          else {
            shove(a, -1, need * 0.5);
            shove(b, 1, need * 0.5);
          }
        }
      }
      aimCamera();
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (!s) continue;
        if (!marks[i]) marks[i] = layMark(s, i === 0 ? left.element : right.element);
        const mark = marks[i];
        if (!mark?.mesh) continue;
        const wide = Math.max(hull(s).across, hull(s).along * 0.9, 0.34) * 1.35;
        mark.mesh.position.x = s.x;
        mark.mesh.position.z = s.z;
        mark.mesh.position.y = s.foot + 0.03;
        mark.mesh.scale.set(wide / 0.42, 0.07, wide / 0.42);
        mark.glow += ((s.pose > performance.now() ? 1.15 : 0.72) - mark.glow) * 0.14;
        if (mark.mesh.material) mark.mesh.material.emissiveIntensity = mark.glow;
      }
      const born = Number(chip.dataset.born || 0);
      if (born) {
        const u = (performance.now() - born) / 880;
        chip.style.opacity = String(Math.max(0, 1 - u));
        const rise = Number(chip.dataset.y || 0) - u * 36;
        chip.style.top = `${rise}px`;
      }
      const cam = stage?.activeCamera || stage?.camera;
      if (cam && homeFov == null && typeof cam.fov === "number") homeFov = cam.fov;
      if (cam && homeFov != null && typeof cam.fov === "number") {
        cam.fov = homeFov - Math.min(6.5, punch * 7);
        cam.updateProjectionMatrix?.();
        punch *= 0.9;
      }
      raf2 = requestAnimationFrame(tick);
    };
    const stand = (fig, side, gait) => {
      const root = fig.view?.root;
      if (!root) return;
      const x = side * span * 0.5;
      const y = footOf(fig);
      const slot = {
        fig,
        root,
        anim: fig.anim,
        x,
        y,
        z: 0,
        tx: x,
        ty: y,
        tz: 0,
        foot: y,
        motion: "",
        gait,
        lunge: 0,
        rush: 0,
        pose: 0,
        press: 0
      };
      root.position.set(x, y, 0);
      root.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      root.visible = true;
      slots.push(slot);
    };
    void (async () => {
      const api = duelApi();
      const ctx = labCtx();
      if (!api || !ctx) {
        paint2("The habitat has no body to put on the ground.");
        settle(false);
        return;
      }
      if (ctx.state?.present && ctx.state.present !== "natural") {
        try {
          ctx.setPresent?.("natural");
        } catch {
        }
      }
      const until = performance.now() + 2e4;
      while (!closed && performance.now() < until) {
        if (ctx.busy) {
          await wait(160);
          continue;
        }
        const figs = ctx.figs ?? [];
        const plantedHero = figs.find((f) => !f.duelGuest && planted(f));
        if ((ctx.state?.present ?? "natural") === "natural" && plantedHero) break;
        await wait(160);
      }
      if (closed) return;
      const liveId = ctx.state?.genome?.id;
      const liveStage = ctx.state?.stage;
      const isLive = (c) => Boolean(liveId && c.genomeId === liveId && c.stage === liveStage);
      heroFig = (ctx.figs ?? []).find((f) => !f.duelGuest && planted(f) && (!liveStage || f.stage === liveStage)) ?? (ctx.figs ?? []).find((f) => !f.duelGuest && planted(f)) ?? null;
      const take = async (c) => {
        if (isLive(c) && heroFig?.view?.root) return heroFig;
        try {
          const fig = await api.grow(c.stage, c.genomeId);
          if (fig) guests.push(fig);
          return fig;
        } catch {
          return null;
        }
      };
      const figL = await take(left);
      if (closed) {
        for (const fig of guests) api.drop(fig);
        return;
      }
      const figR = await take(right);
      if (closed) {
        for (const fig of guests) api.drop(fig);
        return;
      }
      if (!figL?.view?.root || !figR?.view?.root || figL === figR) {
        paint2("One of them did not take a body.");
        for (const fig of guests) api.drop(fig);
        guests.length = 0;
        settle(false);
        return;
      }
      if (heroFig?.view?.root && figL !== heroFig && figR !== heroFig) {
        heroHidden = heroFig.view.root.visible;
        heroFig.view.root.visible = false;
      } else if (heroFig?.view?.root && (figL === heroFig || figR === heroFig)) {
        const home = heroFig.view.root;
        heroHome = { x: home.position.x, y: home.position.y, z: home.position.z, ry: home.rotation.y };
      }
      span = Math.max(reachOf(figL) + reachOf(figR) + 0.55, 0.7);
      covers = habitatCovers(api, span, `${left.ecology} ${right.ecology}`, `${left.element} ${right.element}`);
      stand(figL, -1, left.gait);
      stand(figR, 1, right.gait);
      api.hold(true);
      await wait(80);
      paint2(`${left.name} and ${right.name}. Drag to walk around them.`);
      running2 = true;
      raf2 = requestAnimationFrame(tick);
      settle(true);
    })();
    const onPointerDown = (ev) => {
      const el2 = ev.target instanceof Element ? ev.target : null;
      if (el2?.closest("canvas")) {
        pointerDown = true;
        downX = ev.clientX;
        downY = ev.clientY;
      }
    };
    const onPointerUp = (ev) => {
      const dragged = Math.hypot(ev.clientX - downX, ev.clientY - downY) > 10;
      pointerDown = false;
      if (dragged) {
        userUntil = performance.now() + 2200;
        return;
      }
      if (!running2 || ev.button !== 0) return;
      const api = duelApi();
      const hit = api?.ground(ev.clientX, ev.clientY);
      if (!hit || !api) return;
      if (Math.hypot(hit.x, hit.z) > span * 1.4) return;
      const mesh = api.stone(hit.x, hit.z, 0.28);
      if (mesh) stones.push(mesh);
      covers = [
        ...covers,
        {
          x: clamp(0.5 + hit.x / span, 0.08, 0.92),
          y: clamp(0.6 + hit.z / span, 0.3, 0.9),
          r: 0.08,
          kind: "stone"
        }
      ].slice(-6);
      paint2("A stone is in the way.");
    };
    let downX = 0;
    let downY = 0;
    app.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    const project = (x, y, z) => {
      const cam = stage?.activeCamera || stage?.camera;
      const e = cam?.matrixWorldInverse?.elements;
      const p = cam?.projectionMatrix?.elements;
      if (!cam || !e || !p || e.length < 16 || p.length < 16) return null;
      try {
        cam.updateMatrixWorld?.(true);
      } catch {
      }
      const x1 = e[0] * x + e[4] * y + e[8] * z + e[12];
      const y1 = e[1] * x + e[5] * y + e[9] * z + e[13];
      const z1 = e[2] * x + e[6] * y + e[10] * z + e[14];
      const w1 = e[3] * x + e[7] * y + e[11] * z + e[15];
      const x2 = p[0] * x1 + p[4] * y1 + p[8] * z1 + p[12] * w1;
      const y2 = p[1] * x1 + p[5] * y1 + p[9] * z1 + p[13] * w1;
      const w2 = p[3] * x1 + p[7] * y1 + p[11] * z1 + p[15] * w1;
      if (!Number.isFinite(w2) || Math.abs(w2) < 1e-6) return null;
      const gl = document.querySelector("canvas:not(#primordia-fx)");
      const fx = document.getElementById("primordia-fx") ?? app;
      if (!(gl instanceof HTMLElement)) return null;
      const gr = gl.getBoundingClientRect();
      const fr = fx.getBoundingClientRect();
      return {
        x: (x2 / w2 * 0.5 + 0.5) * gr.width + gr.left - fr.left,
        y: (-y2 / w2 * 0.5 + 0.5) * gr.height + gr.top - fr.top
      };
    };
    const screenAim = (actorIsLeft, fromWorld, toWorld) => {
      const r = app.getBoundingClientRect();
      const fallback = actorIsLeft ? { from: { x: r.width * 0.32, y: r.height * 0.55 }, to: { x: r.width * 0.68, y: r.height * 0.55 } } : { from: { x: r.width * 0.68, y: r.height * 0.55 }, to: { x: r.width * 0.32, y: r.height * 0.55 } };
      if (fromWorld && toWorld) {
        const pa2 = project(fromWorld.x, fromWorld.y, fromWorld.z);
        const pb2 = project(toWorld.x, toWorld.y, toWorld.z);
        if (pa2 && pb2) return { from: pa2, to: pb2 };
      }
      const actor = slots[actorIsLeft ? 0 : 1];
      const other = slots[actorIsLeft ? 1 : 0];
      if (!actor || !other) return fallback;
      const ah = Math.max(0.2, (actor.fig.build?.max?.[1] ?? bodyLen(actor.fig)) * 0.62);
      const bh = Math.max(0.2, (other.fig.build?.max?.[1] ?? bodyLen(other.fig)) * 0.5);
      const pa = project(actor.x, actor.y + ah, actor.z);
      const pb = project(other.x, other.y + bh, other.z);
      if (!pa || !pb) return fallback;
      return { from: pa, to: pb };
    };
    const put = (slot, nx, ny, nz) => {
      if (!slot) return;
      slot.tx = (nx - 0.5) * span;
      slot.tz = (ny - 0.6) * span * 0.55;
      const lift = Math.max(-0.45, nz) * Math.min(span, 6) * 0.42;
      slot.ty = slot.foot + lift;
    };
    return {
      ready,
      blow(event) {
        const ax0 = slots[0] ? 0.5 + slots[0].x / span : 0.22;
        const dx0 = slots[1] ? 0.5 + slots[1].x / span : 0.78;
        const ay0 = slots[0] ? 0.6 + slots[0].z / span : 0.6;
        const dy0 = slots[1] ? 0.6 + slots[1].z / span : 0.6;
        const key = `${event.animationKey ?? ""} ${event.fxMotion ?? ""} ${event.attackName}`;
        const actorIsLeft = event.actorId === left.id;
        const actor = actorIsLeft ? left : right;
        const defender = actorIsLeft ? right : left;
        let hitFrom = null;
        let hitTo = null;
        const path = chooseLine(actor, defender, event.attackId, key, covers, actorIsLeft ? ax0 : dx0, actorIsLeft ? ay0 : dy0, actorIsLeft ? dx0 : ax0, actorIsLeft ? dy0 : ay0);
        if (actorIsLeft) {
          put(slots[0], path.ax, path.ay, path.az);
          put(slots[1], path.dx, path.dy, path.dz);
        } else {
          put(slots[1], path.ax, path.ay, path.az);
          put(slots[0], path.dx, path.dy, path.dz);
        }
        const actorSlot = slots[actorIsLeft ? 0 : 1];
        const defendSlot = slots[actorIsLeft ? 1 : 0];
        if (actorSlot && defendSlot && event.attackId !== "knit" && event.attackId !== "dot") {
          const shape = strikeOf(event.fxMotion ?? "", key);
          const attackerHull = hull(actorSlot);
          const weapon = shape.weapon * Math.max(attackerHull.along, attackerHull.across);
          const dx = defendSlot.x - actorSlot.x;
          const dz = defendSlot.z - actorSlot.z;
          const dist = Math.hypot(dx, dz) || 1;
          const ux = dx / dist;
          const uz = dz / dist;
          const gap = Math.max(0.12, centers(actorSlot, defendSlot, weapon) * shape.gap);
          const flank = shape.flank * attackerHull.across;
          const px2 = -uz;
          const pz = ux;
          if (actorSlot.gait === "rooted") {
            actorSlot.tx = actorSlot.x;
            actorSlot.tz = actorSlot.z;
            if (!shape.ranged && defendSlot.gait !== "rooted") {
              defendSlot.tx = actorSlot.x + ux * gap;
              defendSlot.tz = actorSlot.z + uz * gap;
            }
          } else {
            actorSlot.tx = defendSlot.x - ux * gap + px2 * flank;
            actorSlot.tz = defendSlot.z - uz * gap + pz * flank;
            if (event.fxMotion === "yank" && defendSlot.gait !== "rooted") {
              const pull = Math.max(0.12, centers(actorSlot, defendSlot, weapon * 0.35));
              defendSlot.tx = actorSlot.x + ux * pull;
              defendSlot.tz = actorSlot.z + uz * pull;
            }
          }
          actorSlot.ty = actorSlot.foot + shape.lift * attackerHull.tall;
          actorSlot.press = gap;
          defendSlot.press = gap;
          if (defendSlot.gait !== "rooted" && event.fxMotion !== "yank") {
            const away = shape.ranged ? 0.08 : Math.min(attackerHull.across, 0.06 + (Number(event.damage) || 8) / 180);
            defendSlot.tx += ux * away;
            defendSlot.tz += uz * away;
            defendSlot.lunge = -Math.min(attackerHull.along * 0.35, away);
            defendSlot.rush = performance.now() + 700;
          }
          actorSlot.lunge = shape.lunge * attackerHull.along;
          actorSlot.rush = performance.now() + 980;
          actorSlot.pose = performance.now() + 1400;
          drama = shape.lift > 0.2 ? 0.35 : shape.ranged ? 0.12 : shape.rear ? -0.08 : 0;
          punch = 1;
          shake2 = Math.min(0.22, 0.05 + (Number(event.damage) || 8) / 220);
        }
        if (event.attackId === "knit" || event.attackId === "dot") {
          if (actorIsLeft) hpL = event.hpAfter;
          else hpR = event.hpAfter;
        } else if (actorIsLeft) hpR = event.hpAfter;
        else hpL = event.hpAfter;
        const mass = actor.sizeM > 2.2 ? "heavy" : actor.sizeM < 0.9 ? "light" : "medium";
        if (actorSlot?.anim && event.animationKey && event.attackId !== "knit" && event.attackId !== "dot") {
          playAttack(actorSlot.anim, event.animationKey, mass, event.fxMotion);
        }
        if (defendSlot?.anim && event.attackId !== "knit") {
          const massD = defender.sizeM > 2.2 ? "heavy" : defender.sizeM < 0.9 ? "light" : "medium";
          playOwnedAct(defendSlot.anim, GUARD_ACTS, massD);
        }
        const api = duelApi();
        const color = ELEMENT_COLOR[event.element || actor.element] ?? ELEMENT_COLOR.beast;
        const power = Math.min(1.6, 0.45 + (Number.isFinite(event.damage) ? event.damage : 12) / 40);
        if (api && actorSlot && defendSlot) {
          const shape = strikeOf(event.fxMotion ?? "", key);
          const yaw = actorSlot.root.rotation.y;
          const fx = Math.sin(yaw);
          const fz = Math.cos(yaw);
          const sx = Math.cos(yaw);
          const sz = -Math.sin(yaw);
          const attackerHull = hull(actorSlot);
          const reach = attackerHull.along + shape.weapon * Math.max(attackerHull.along, attackerHull.across);
          const dir = shape.rear ? -1 : 1;
          const from = {
            x: actorSlot.x + fx * reach * dir + sx * shape.flank * attackerHull.across,
            y: actorSlot.y + attackerHull.tall * (shape.lift > 0.2 ? 0.82 : shape.rear ? 0.38 : shape.ranged ? 0.62 : 0.48),
            z: actorSlot.z + fz * reach * dir + sz * shape.flank * attackerHull.across
          };
          const dx = defendSlot.x - from.x;
          const dz = defendSlot.z - from.z;
          const dist = Math.hypot(dx, dz) || 1;
          const ux = dx / dist;
          const uz = dz / dist;
          const skin = supportRadius(hull(defendSlot), defendSlot.root.rotation.y, -dx, -dz);
          const to = {
            x: defendSlot.x - ux * skin,
            y: defendSlot.y + hull(defendSlot).tall * (shape.lift > 0.2 ? 0.3 : 0.55),
            z: defendSlot.z - uz * skin
          };
          hitFrom = from;
          hitTo = to;
          api.flash(to.x, to.y, to.z, color, power);
          const times = Math.max(1, Math.min(3, event.hits ?? 1));
          for (let n = 1; n < times; n++) {
            window.setTimeout(() => {
              try {
                api.flash(to.x, to.y, to.z, color, power * 0.75);
              } catch {
              }
            }, n * 150);
          }
          if (shape.ranged || event.attackId === "dot") api.bolt(from.x, from.y, from.z, to.x, to.y, to.z, color);
          const ring2 = Math.max(0.16, hull(defendSlot).across * (shape.lift > 0.2 ? 1.45 : 1.05));
          const sparks = shape.ranged ? 3 : 5;
          for (let i = 0; i < sparks; i++) {
            const ang = i / sparks * Math.PI * 2;
            const x = to.x + Math.cos(ang) * ring2;
            const z = to.z + Math.sin(ang) * ring2;
            const y = shape.lift > 0.2 ? to.y * 0.45 + defendSlot.y * 0.55 : to.y;
            window.setTimeout(() => {
              try {
                api.flash(x, y, z, color, power * 0.55);
              } catch {
              }
            }, 36 + i * 28);
          }
          if (!shape.ranged) {
            window.setTimeout(() => {
              try {
                api.flash((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2, color, power * 0.4);
              } catch {
              }
            }, 24);
          }
          for (const mesh of stones) {
            const pos = mesh?.position;
            if (!pos) continue;
            const sx2 = pos.x - to.x;
            const sz2 = pos.z - to.z;
            const sd = Math.hypot(sx2, sz2);
            if (sd > 0.02 && sd < Math.max(0.45, bodyLen(defendSlot.fig))) {
              pos.x += sx2 / sd * 0.16;
              pos.z += sz2 / sd * 0.16;
            }
          }
          try {
            actorSlot.anim?.flare?.(1.6 + power);
            defendSlot.anim?.flare?.(2.4);
            window.setTimeout(() => {
              try {
                actorSlot.anim?.flare?.(1);
                defendSlot.anim?.flare?.(1);
              } catch {
              }
            }, 700);
          } catch {
          }
        }
        const struck = event.attackId === "knit" || event.attackId === "dot" ? actorIsLeft : !actorIsLeft;
        const hue = event.element || (struck ? actorIsLeft ? left.element : right.element : actor.element);
        const struckIndex = struck ? 0 : 1;
        if (marks[struckIndex]) marks[struckIndex].glow = 1.7;
        veil.style.setProperty("--hit", rgba(hue, 0.55));
        veil.classList.add("on");
        window.setTimeout(() => veil.classList.remove("on"), 60);
        strip.classList.remove("hurt-l", "hurt-r");
        strip.classList.add(struck ? "hurt-l" : "hurt-r");
        line.style.color = tint(hue);
        (struck ? barL : barR).classList.add("flash");
        window.setTimeout(() => (struck ? barL : barR).classList.remove("flash"), 220);
        const landed = event.attackId === "knit" ? "knits" : event.attackId === "dot" ? "lingers" : event.ko ? "fells" : "lands";
        paint2(
          event.damage ? `${event.attackName} ${landed} ${event.damage}${event.aside ? `. ${event.aside}` : ""}` : event.attackName
        );
        const pt = hitTo ? project(hitTo.x, hitTo.y + 0.25, hitTo.z) : null;
        const box = app.getBoundingClientRect();
        const px = pt?.x ?? box.width * (struck ? 0.3 : 0.7);
        const py = pt?.y ?? box.height * 0.46;
        const mark = event.attackId === "knit" ? `+${event.damage ?? 0}` : event.ko ? `${event.damage ?? 0}` : `\u2212${event.damage ?? 0}`;
        pop.style.left = `${px}px`;
        pop.style.top = `${py}px`;
        pop.style.setProperty("--hit", tint(hue));
        popNum.textContent = mark;
        pop.classList.remove("on");
        void pop.offsetWidth;
        pop.classList.add("on");
        return screenAim(actorIsLeft, hitFrom, hitTo);
      },
      finish(winnerId) {
        const win = winnerId === left.id ? slots[0] : winnerId === right.id ? slots[1] : void 0;
        const lose = winnerId === left.id ? slots[1] : winnerId === right.id ? slots[0] : void 0;
        const mass = (c) => c.sizeM > 2.2 ? "heavy" : c.sizeM < 0.9 ? "light" : "medium";
        if (win) playOwnedAct(win.anim, ["display", "rear", "glow_pulse", "wing_stretch", "hover_bob"], mass(winnerId === left.id ? left : right));
        if (lose) playOwnedAct(lose.anim, ["withdraw", "lie", "burrow", "coil", "shake_off"], mass(winnerId === left.id ? right : left));
        const name = winnerId === left.id ? left.name : winnerId === right.id ? right.name : "";
        paint2(name ? `${name} stands.` : "Neither falls.");
        drama = 0;
      },
      close() {
        if (closed) return;
        closed = true;
        running2 = false;
        if (raf2) cancelAnimationFrame(raf2);
        app.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointerup", onPointerUp);
        const api = duelApi();
        api?.hold(false);
        for (const mesh of stones) api?.unstone(mesh);
        for (const fig of guests) api?.drop(fig);
        guests.length = 0;
        if (heroFig?.view?.root) {
          if (heroHidden) heroFig.view.root.visible = true;
          else if (heroHome && heroFig.view.root.parent) {
            heroFig.view.root.position.set(heroHome.x, heroHome.y, heroHome.z);
            heroFig.view.root.rotation.y = heroHome.ry;
          }
          try {
            heroFig.anim?.setMotion?.("idle");
          } catch {
          }
        }
        if (homeFov != null) {
          const cam = stage?.activeCamera || stage?.camera;
          if (cam && typeof cam.fov === "number") {
            cam.fov = homeFov;
            cam.updateProjectionMatrix?.();
          }
        }
        for (const mark of marks) duelApi()?.unstone(mark?.mesh ?? null);
        marks[0] = null;
        marks[1] = null;
        strip.remove();
        veil.remove();
        chip.remove();
        pop.remove();
        app.classList.remove("duel-on");
        try {
          layout?.setImmersive?.(wasImmersive);
        } catch {
        }
        try {
          stage?.setAutoRotate?.(wasSpinning);
        } catch {
        }
        if (stage && keepInsets) stage.setInsets = keepInsets;
        settle(false);
      }
    };
  }

  // primordia-specimen-lab/combat/adapter.ts
  var SINGULAR = {
    horns: "horn",
    tentacles: "tentacle",
    wings: "wing",
    tails: "tail",
    fins: "fin",
    arms: "arm",
    antennae: "antenna",
    eyes: "eye",
    ears: "ear",
    legs: "leg"
  };
  var FANG_TEETH = /* @__PURE__ */ new Set(["fangs", "carnassial", "serrated", "needle", "conical"]);
  function isRecord(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }
  function num(v, fallback) {
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
  }
  function str(v) {
    return typeof v === "string" && v.length ? v : void 0;
  }
  function asRelic(v) {
    if (!isRecord(v)) return void 0;
    const kind = str(v.kind);
    const use = str(v.use);
    if (!kind || !use) return void 0;
    return {
      kind,
      matter: str(v.matter) ?? "bone",
      use,
      held: v.held === true || v.held === 1
    };
  }
  function sculptureOf(part) {
    const found = [];
    const p = isRecord(part.p) ? part.p : void 0;
    for (const src of [part.sculpture, p?.sculpture]) {
      if (typeof src === "string") found.push(src);
      else if (Array.isArray(src)) {
        for (const s of src) if (typeof s === "string") found.push(s);
      }
    }
    return found;
  }
  function unitsFromParts(parts) {
    const map = /* @__PURE__ */ new Map();
    const sculpture = [];
    let claws;
    for (const raw of parts) {
      if (!isRecord(raw)) continue;
      const sys = str(raw.sys);
      if (!sys) continue;
      const dev = str(raw.dev);
      if (dev === "absent" || dev === "none") continue;
      const fam = str(raw.fam);
      const weight = dev === "partial" || dev === "bud" ? 0.5 : 1;
      let unit = SINGULAR[sys] ?? sys;
      if (sys === "dorsal" && fam && /spine|quill|spike|thorn/.test(fam)) unit = "spine";
      if (sys === "dorsal" && fam && /shell|whorl/.test(fam)) unit = "shell";
      const prev = map.get(unit) ?? { count: 0, role: fam };
      prev.count += weight;
      if (fam) prev.role = fam;
      map.set(unit, prev);
      sculpture.push(...sculptureOf(raw));
      if (sys === "arms") {
        const term = str(raw.term) ?? (isRecord(raw.p) ? str(raw.p.term) : void 0);
        if (term && term !== "none" && term !== "hand") claws = term;
        else if (!claws && fam && /claw|talon|pincer|scythe/.test(fam)) claws = fam;
      }
    }
    const units = [];
    for (const [unit, v] of map) {
      if (v.count < 0.5) continue;
      if (unit === "shell") continue;
      units.push({ unit, role: v.role, count: Math.max(1, Math.round(v.count)) });
    }
    return { units, claws, sculpture };
  }
  function alreadyCombat(input) {
    return Array.isArray(input.units) && isRecord(input.covering) && typeof input.covering.type === "string" && typeof input.sizeM === "number" && !Array.isArray(input.parts);
  }
  function normalizeCombat(input) {
    const units = input.units.map((u) => ({
      unit: String(u.unit),
      role: u.role,
      count: u.count
    }));
    const covering = input.covering;
    const ascent = isRecord(input.ascent) ? {
      organ: str(input.ascent.organ),
      level: typeof input.ascent.level === "number" ? input.ascent.level : void 0,
      relic: asRelic(input.ascent.relic)
    } : void 0;
    const shell = isRecord(input.shell) ? { sculpture: Array.isArray(input.shell.sculpture) ? input.shell.sculpture.map(String) : void 0 } : void 0;
    return {
      sizeM: num(input.sizeM, 1),
      element: str(input.element) ?? "beast",
      element2: str(input.element2),
      covering: { type: covering.type || "skin" },
      build: str(input.build) ?? "medium",
      units,
      features: Array.isArray(input.features) ? input.features.map(String) : [],
      claws: str(input.claws),
      shell,
      ascent,
      loco: str(input.loco),
      ecology: str(input.ecology),
      plan: str(input.plan),
      volant: input.volant === true || input.volant === 1,
      stats: isRecord(input.stats) ? input.stats : void 0
    };
  }
  function toCombatPhenotype(input, hints) {
    if (!isRecord(input)) {
      return {
        sizeM: 1,
        element: "beast",
        covering: { type: "skin" },
        build: "medium",
        units: []
      };
    }
    if (alreadyCombat(input)) return normalizeCombat(input);
    const parts = Array.isArray(input.parts) ? input.parts : [];
    const fromParts = unitsFromParts(parts);
    const features = [];
    for (const key of ["features", "traits", "myth", "anomaly"]) {
      const list = input[key];
      if (Array.isArray(list)) {
        for (const item of list) if (typeof item === "string") features.push(item);
      }
    }
    if (Array.isArray(input.adapt)) {
      for (const item of input.adapt) {
        if (typeof item === "string") features.push(item);
        else if (isRecord(item) && typeof item.id === "string") features.push(item.id);
      }
    }
    const head = isRecord(input.head) ? input.head : void 0;
    const teeth = head && isRecord(head.teeth) ? str(head.teeth.type) : str(head?.teeth);
    if (teeth && FANG_TEETH.has(teeth)) features.push(teeth === "fangs" ? "fang" : teeth);
    if (str(head?.jaw) === "mandibles") features.push("mandible");
    const coveringRec = isRecord(input.covering) ? input.covering : void 0;
    const covering = str(coveringRec?.type) ?? str(input.covering) ?? "skin";
    const ascentRec = isRecord(input.ascent) ? input.ascent : void 0;
    const ascRec = isRecord(input.asc) ? input.asc : void 0;
    const relic = asRelic(ascentRec?.relic);
    const organ = str(ascentRec?.organ);
    const level = num(ascentRec?.level, num(ascRec?.level, 0));
    const ascent = organ || relic || level > 0 ? { organ, level, relic } : void 0;
    let build = str(ascentRec?.build) ?? str(input.build);
    if (!build && isRecord(input.body)) build = str(input.body.build);
    if (!build) build = "medium";
    const sculpture = [...fromParts.sculpture];
    const buildRec = isRecord(hints?.build) ? hints.build : void 0;
    const morph = buildRec && isRecord(buildRec.morph) ? buildRec.morph : void 0;
    const shellObj = morph && isRecord(morph.shell) ? morph.shell : buildRec && isRecord(buildRec.shell) ? buildRec.shell : void 0;
    if (shellObj) {
      if (typeof shellObj.sculpture === "string") sculpture.push(shellObj.sculpture);
      else if (Array.isArray(shellObj.sculpture)) {
        for (const s of shellObj.sculpture) if (typeof s === "string") sculpture.push(s);
      }
    }
    const shell = sculpture.length || covering === "shell" ? { sculpture: [...new Set(sculpture)] } : void 0;
    let stats = hints?.stats ?? (isRecord(input.stats) ? input.stats : void 0);
    if (!stats && isRecord(input.line) && typeof input.line.vigor === "number") {
      const v = input.line.vigor;
      stats = { vigor: Math.max(0.5, Math.min(1.6, 0.85 + (v - 128) / 128 * 0.35)) };
    }
    return {
      sizeM: num(input.sizeM, 1),
      element: str(input.element) ?? "beast",
      element2: str(input.element2),
      covering: { type: covering },
      build,
      units: fromParts.units,
      features,
      claws: str(input.claws) ?? fromParts.claws,
      shell,
      ascent,
      loco: str(input.loco),
      ecology: str(input.ecology),
      plan: str(input.plan),
      volant: input.volant === true || input.volant === 1,
      stats,
      diet: str(input.diet),
      mouth: head ? str(head.mouth) : void 0,
      mouths: head && typeof head.mouths === "number" ? head.mouths : void 0,
      massKg: typeof input.massKg === "number" && input.massKg > 0 ? input.massKg : void 0
    };
  }

  // primordia-specimen-lab/combat/battle.ts
  function armorCut(material) {
    const a = Math.max(0, material);
    return a / (a + 0.85) * 0.46;
  }
  function blowCap(maxHp) {
    return Math.max(6, Math.round(Math.max(1, maxHp) * 0.3));
  }
  function massLean(attackerHp, defenderHp) {
    const ratio = Math.max(0.45, attackerHp / Math.max(1, defenderHp));
    return 1 / Math.pow(ratio, 0.72);
  }
  function expectedThreat(attack) {
    const hits = attack.hits ?? 1;
    const aoe = attack.aoeRadius ? 1 + Math.min(0.25, attack.aoeRadius * 0.05) : 1;
    const echo = attack.flags.includes("echo") ? attack.power * 0.12 : 0;
    const dot = attack.type === "dot" ? attack.power * 0.28 * 2 : 0;
    return (attack.power * hits * aoe + echo + dot) / Math.max(1, attack.cooldown);
  }
  function resistOf(attack, defense) {
    let resist = defense.elementalResist[attack.element] ?? 0;
    if (attack.flags.includes("dual") && attack.element2) {
      resist = (resist + (defense.elementalResist[attack.element2] ?? 0)) / 2;
    }
    if (attack.type === "special") resist *= 0.75;
    return Math.max(-0.34, Math.min(0.4, resist));
  }
  function profile(attack) {
    let armor = attack.type === "breath" || attack.type === "projectile" ? 0.86 : 1;
    let power = 1;
    const motion = attack.fxMotion;
    if (motion === "bite" || motion === "grind") armor += 0.06;
    else if (motion === "lash" || motion === "volley" || motion === "rain" || motion === "sting") armor -= 0.04;
    else if (motion === "stream" || motion === "spiral" || motion === "sigil") armor -= 0.03;
    else if (motion === "charge" || motion === "thrust" || motion === "slam") power += 0.04;
    else if (motion === "cone" || motion === "burst" || motion === "wing") power += 0.03;
    else if (motion === "yank" || motion === "brume" || motion === "wall") power -= 0.05;
    if (attack.flags.includes("venom") && attack.type !== "dot") power -= 0.04;
    return {
      armor: Math.max(0.82, Math.min(1.08, armor)),
      power: Math.max(0.9, Math.min(1.08, power))
    };
  }
  function strikeDamage(attack, defense) {
    const resist = resistOf(attack, defense);
    const hits = attack.hits ?? 1;
    const shaped = profile(attack);
    const armor = defense.armor * shaped.armor;
    let raw = attack.power * hits * shaped.power * (1 - armor) * (1 - resist);
    if (attack.aoeRadius) raw *= 1 + Math.min(0.25, attack.aoeRadius * 0.05);
    const grounded = (attack.type === "slam" || attack.animationKey === "body_charge") && !attack.flags.includes("aerial");
    if (defense.airborne && grounded) raw *= 0.9;
    else if (attack.flags.includes("aerial") && !defense.airborne) raw *= 1.06;
    return Math.max(1, Math.round(raw));
  }
  function relicMatches(aspect, attack) {
    if (!aspect || aspect === "guard") return true;
    if (aspect === "smash" || aspect === "brawl") return attack.type === "melee" || attack.type === "slam";
    if (aspect === "reach") return attack.type === "melee" && attack.range <= 2.4;
    if (aspect === "gust" || aspect === "light") return attack.type === "breath" || attack.type === "projectile";
    if (aspect === "focus") return attack.type === "special" || attack.type === "breath";
    if (aspect === "steady") return attack.type === "slam" || attack.fxMotion === "charge" || attack.animationKey === "body_charge";
    return true;
  }
  function choose(side, foe) {
    const read = (side.fighter.defense.focus ?? 1) >= 1.12;
    let best = -1;
    let score = -1;
    side.fighter.attacks.forEach((attack, i) => {
      if ((side.cd[i] ?? 0) > 0) return;
      const priority = attack.flags.includes("priority") ? 6 : 0;
      let s = (read ? strikeDamage(attack, foe.fighter.defense) : attack.power) + priority;
      const rooted = side.fighter.defense.footing === "rooted" && foe.fighter.defense.footing !== "rooted";
      const short = (attack.type === "melee" || attack.type === "slam") && attack.range < 3;
      if (rooted && short) s *= 0.4;
      if (s > score) {
        score = s;
        best = i;
      }
    });
    return best;
  }
  function resolveBattle(a, b, maxTurns = 16) {
    const sides = [
      { fighter: a, hp: a.defense.hp, cd: a.attacks.map(() => 0), dots: [], aegisUsed: false, braced: false },
      { fighter: b, hp: b.defense.hp, cd: b.attacks.map(() => 0), dots: [], aegisUsed: false, braced: false }
    ];
    const log = [];
    let actor = a.defense.hp < b.defense.hp ? 0 : b.defense.hp < a.defense.hp ? 1 : (a.defense.initiative ?? 1) >= (b.defense.initiative ?? 1) ? 0 : 1;
    let turn = 1;
    const alive = () => sides[0].hp > 0 && sides[1].hp > 0;
    while (turn <= maxTurns && alive()) {
      const self = sides[actor];
      const foe = sides[1 - actor];
      let dotSum = 0;
      const dotNames = [];
      let dotElement = "beast";
      self.dots = self.dots.filter((dot) => {
        if (dot.left <= 0) return false;
        dotSum += dot.damage;
        dot.left -= 1;
        dotNames.push(dot.name);
        dotElement = dot.element;
        return dot.left > 0;
      });
      if (dotSum > 0) {
        self.hp = Math.max(0, self.hp - dotSum);
        log.push({
          turn,
          actorId: self.fighter.id,
          actorName: self.fighter.name,
          attackName: dotNames.join(", "),
          attackId: "dot",
          animationKey: "act",
          damage: dotSum,
          hpAfter: self.hp,
          targetName: self.fighter.name,
          ko: self.hp <= 0,
          element: dotElement,
          fxMotion: "brume",
          text: `${self.fighter.name} takes ${dotSum} from ${dotNames.join(", ")}.`
        });
        if (self.hp <= 0) break;
      }
      const knit = self.fighter.defense.specials.find((s) => s.id === "sap-knit");
      if (knit && self.hp > 0 && self.hp < self.fighter.defense.hp) {
        const heal = Math.max(1, Math.round(self.fighter.defense.hp * Math.min(0.02, knit.value * 0.35)));
        const before = self.hp;
        self.hp = Math.min(self.fighter.defense.hp, self.hp + heal);
        if (self.hp > before) {
          log.push({
            turn,
            actorId: self.fighter.id,
            actorName: self.fighter.name,
            attackName: knit.name,
            attackId: "knit",
            animationKey: "act",
            damage: self.hp - before,
            hpAfter: self.hp,
            targetName: self.fighter.name,
            ko: false,
            element: "plant",
            fxMotion: "knit",
            text: `${self.fighter.name} knits ${self.hp - before} back (${self.hp} now).`
          });
        }
      }
      self.cd = self.cd.map((c) => Math.max(0, c - 1));
      const index = choose(self, foe);
      if (index < 0) {
        actor = 1 - actor;
        if (actor === 0) turn += 1;
        continue;
      }
      const attack = self.fighter.attacks[index];
      const rawDamage = Math.max(1, Math.round(strikeDamage(attack, foe.fighter.defense) * (self.fighter.defense.edge ?? 1)));
      const leaned = Math.max(1, Math.round(rawDamage * massLean(self.fighter.defense.hp, foe.fighter.defense.hp)));
      const cap = blowCap(foe.fighter.defense.hp);
      let damage = Math.min(leaned, cap);
      const limited = damage < rawDamage;
      const aside = [];
      const ranged2 = attack.type === "breath" || attack.type === "projectile";
      if (ranged2 && foe.fighter.defense.armor >= 0.2) aside.push("It finds a seam.");
      if (attack.flags.includes("dual") && attack.element2) aside.push("Both elements arrive.");
      if (foe.fighter.defense.airborne && (attack.type === "slam" || attack.animationKey === "body_charge") && !attack.flags.includes("aerial")) {
        aside.push("It meets air.");
      }
      const planted2 = foe.fighter.defense.specials.find((s) => s.id === "immovable");
      if (planted2 && (attack.type === "slam" || attack.fxMotion === "charge" || attack.fxMotion === "thrust")) {
        damage = Math.max(1, Math.round(damage * 0.94));
        aside.push("It does not give the ground.");
      }
      const coat = foe.fighter.defense.specials.find((s) => s.id === "mucus");
      if (coat && attack.element === "water") {
        damage = Math.max(1, Math.round(damage * (1 - Math.min(0.14, coat.value))));
        aside.push("The coat shrugs it.");
      } else if (coat && attack.type === "melee") {
        const cling = Math.max(1, Math.min(Math.round(damage * 0.08), Math.round(self.fighter.defense.hp * 0.04)));
        self.dots.push({ damage: cling, left: 1, name: coat.name, element: attack.element });
        aside.push("It clings.");
      }
      const aegis = foe.fighter.defense.specials.find((s) => s.id === "relic-aegis");
      if (aegis && !foe.aegisUsed && relicMatches(aegis.aspect, attack)) {
        const cut = Math.max(1, Math.round(damage * Math.min(0.22, aegis.value + 0.08)));
        damage = Math.max(1, damage - cut);
        foe.aegisUsed = true;
        aside.push(aegis.aspect && aegis.aspect !== "guard" ? "The relic meets that blow." : "The relic answers.");
      }
      const ward2 = foe.fighter.defense.specials.find((s) => s.id === "ascent-ward");
      if (ward2) {
        const cut = Math.round(damage * Math.min(0.08, ward2.value * 0.4));
        if (cut > 0) {
          damage = Math.max(1, damage - cut);
          aside.push("The ascent holds.");
        }
      }
      const slip = foe.fighter.defense.specials.find((s) => s.id === "slip");
      if (slip && (attack.type === "melee" || attack.type === "slam") && !attack.flags.includes("aerial")) {
        const cut = Math.round(damage * Math.min(0.1, slip.value * 0.16));
        if (cut > 0) {
          damage = Math.max(1, damage - cut);
          aside.push("The wings shed it.");
        }
      }
      const cannotClose = self.fighter.defense.footing === "rooted" && foe.fighter.defense.footing !== "rooted" && (attack.type === "melee" || attack.type === "slam") && attack.range < 3;
      if (cannotClose) {
        damage = Math.max(1, Math.round(damage * 0.72));
        aside.push("It cannot close.");
      }
      if (foe.fighter.defense.brace && !foe.braced) {
        const cut = Math.max(1, Math.round(damage * foe.fighter.defense.brace));
        damage = Math.max(1, damage - cut);
        foe.braced = true;
        aside.push("It sets against the blow.");
      }
      if ((attack.hits ?? 1) > 1) aside.push(`It lands ${attack.hits} times.`);
      foe.hp = Math.max(0, foe.hp - damage);
      self.cd[index] = Math.max(1, attack.cooldown - ((self.fighter.defense.focus ?? 1) >= 1.12 ? 1 : 0));
      if (attack.type === "dot" || attack.flags.includes("echo")) {
        const tick = attack.type === "dot" ? 0.28 : 0.12;
        const turns = attack.type === "dot" ? 2 : 1;
        foe.dots.push({
          damage: Math.max(1, Math.min(Math.round(attack.power * tick), Math.round(foe.fighter.defense.hp * 0.06))),
          left: turns,
          name: attack.name,
          element: attack.element
        });
      }
      const thorn = foe.fighter.defense.specials.find((s) => s.id === "thorns");
      let reflected = 0;
      if (thorn && damage > 0) {
        reflected = Math.min(
          Math.round(damage * Math.min(0.1, thorn.value)),
          Math.round(self.fighter.defense.hp * 0.06)
        );
        if (reflected > 0) self.hp = Math.max(0, self.hp - reflected);
      }
      const hold = foe.fighter.defense.knockbackResist >= 0.45;
      const ko = foe.hp <= 0;
      const lead = aside.find((s) => s !== "It finds a seam.") ?? aside[0];
      const extra = `${lead ? ` ${lead}` : ""}${limited ? " A single moment will not spend the whole fight." : ""}${reflected ? ` Thorns return ${reflected}.` : ""}`;
      log.push({
        turn,
        actorId: self.fighter.id,
        actorName: self.fighter.name,
        attackName: attack.name,
        attackId: attack.id,
        animationKey: attack.animationKey,
        damage,
        hpAfter: foe.hp,
        targetName: foe.fighter.name,
        ko,
        element: attack.element,
        fxMotion: attack.fxMotion,
        fxSeed: attack.fxSeed,
        aside: lead,
        hits: attack.hits,
        text: ko ? `${self.fighter.name} uses ${attack.name} for ${damage}. ${foe.fighter.name} falls.${extra}` : `${self.fighter.name} uses ${attack.name} for ${damage}. ${foe.fighter.name} ${hold ? "holds" : "gives ground"} (${foe.hp} left).${extra}`
      });
      if (self.hp <= 0) break;
      actor = 1 - actor;
      if (actor === 0) turn += 1;
    }
    let winnerId = null;
    if (sides[0].hp <= 0 && sides[1].hp > 0) winnerId = b.id;
    else if (sides[1].hp <= 0 && sides[0].hp > 0) winnerId = a.id;
    else if (sides[0].hp !== sides[1].hp) winnerId = sides[0].hp > sides[1].hp ? a.id : b.id;
    return {
      log,
      winnerId,
      leftHp: sides[0].hp,
      rightHp: sides[1].hp,
      rounds: Math.max(1, turn - (actor === 0 ? 1 : 0))
    };
  }

  // primordia-specimen-lab/combat/catalogue.ts
  var ELEMENTS = [
    "plant",
    "fire",
    "water",
    "earth",
    "ice",
    "electric",
    "plasma",
    "air",
    "metal",
    "light",
    "void",
    "beast"
  ];
  var MANNERS = ["quick", "measured", "charged", "echoing"];
  var MOTIONS = [
    "thrust",
    "arc",
    "chain",
    "lash",
    "stream",
    "cone",
    "burst",
    "volley",
    "spiral",
    "rain",
    "vortex",
    "wall",
    "pulse",
    "charge",
    "sting",
    "bite",
    "sigil",
    "wing",
    "cyclone",
    "slam",
    "yank",
    "grind",
    "brume"
  ];
  var ADJ = {
    plant: "Sap",
    fire: "Cinder",
    water: "Brine",
    earth: "Loam",
    ice: "Rime",
    electric: "Storm",
    plasma: "Solar",
    air: "Gale",
    metal: "Iron",
    light: "Gilt",
    void: "Null",
    beast: "Feral"
  };
  var MANNER_ADJ = {
    quick: "Flickering",
    measured: "Held",
    charged: "Gathered",
    echoing: "Returning"
  };
  var ELEMENT_LINE = {
    plant: "It grows across the distance instead of crossing it.",
    fire: "Heat leaves the body before the light does.",
    water: "The mass of it stays together longer than a spray should.",
    earth: "What is thrown is still part of the ground for a moment.",
    ice: "The edges stay sharp after the sound has gone.",
    electric: "The path chooses itself, and then it is gone.",
    plasma: "A white core, and a skin of colour around it.",
    air: "Pressure arrives first. The body of the wind follows.",
    metal: "A hard note, then sparks finding the grain.",
    light: "The beam is thin, and the room is briefly honest.",
    void: "A little of the space in front of it is asked to leave.",
    beast: "Muscle and breath, and the plain decision to close."
  };
  var MANNER_LINE = {
    quick: "It spends itself early.",
    measured: "It is given at the body's ordinary pace.",
    charged: "It is held back, and arrives heavier.",
    echoing: "A little of it remains, and keeps working."
  };
  var FORMS = [
    { template: "horn_thrust", noun: "Gore", type: "melee", motion: "thrust", gate: "horn1", basePower: 18, range: 1.6, cooldown: 2, flags: ["morph"], blurb: "A single horn drives in and does not glance.", animationKey: "horn_thrust" },
    { template: "horn_sweep", noun: "Sweep", type: "melee", motion: "arc", gate: "horn2", basePower: 16, range: 2.2, cooldown: 2, aoeRadius: 1.2, flags: ["morph"], blurb: "Both horns travel together and clear a crescent.", animationKey: "horn_thrust" },
    { template: "spike_volley", noun: "Volley", type: "projectile", motion: "volley", gate: "horn2", basePower: 20, range: 8, cooldown: 3, aoeRadius: 1.1, flags: ["morph"], blurb: "The crown loosens a fan of its own points.", animationKey: "horn_thrust" },
    { template: "crown_ring", noun: "Crown", type: "slam", motion: "burst", gate: "horn2", basePower: 16, range: 2.4, cooldown: 3, aoeRadius: 1.6, flags: ["morph"], blurb: "The points ring outward as one circle, then settle back to the skull.", animationKey: "horn_thrust" },
    { template: "spine_barrage", noun: "Barrage", type: "projectile", motion: "rain", gate: "spine", basePower: 18, range: 7, cooldown: 3, aoeRadius: 1.2, flags: ["morph"], blurb: "The back opens and spends a little of its hedge.", animationKey: "surface_shard" },
    { template: "quill_fan", noun: "Fan", type: "projectile", motion: "cone", gate: "spine", basePower: 16, range: 6, cooldown: 3, aoeRadius: 1.4, flags: ["morph"], blurb: "Quills leave in a widening sheet, points still aligned.", animationKey: "surface_shard" },
    { template: "dorsal_lance", noun: "Lance", type: "projectile", motion: "thrust", gate: "spine", basePower: 20, range: 7, cooldown: 3, flags: ["morph"], blurb: "One spine is kept until it can be given entirely.", animationKey: "surface_shard" },
    { template: "tentacle_slam", noun: "Crush", type: "slam", motion: "chain", gate: "tentacle1", basePower: 15, range: 2.4, cooldown: 3, hits: 2, flags: ["morph"], blurb: "The arms come down in order, each pinning what the last lifted.", animationKey: "tentacle_chain_slam" },
    { template: "tentacle_whip", noun: "Lash", type: "melee", motion: "lash", gate: "tentacle3", basePower: 16, range: 3.2, cooldown: 2, flags: ["morph"], blurb: "One arm cracks past the reach of the body.", animationKey: "tentacle_whip" },
    { template: "tentacle_coil", noun: "Coil", type: "melee", motion: "vortex", gate: "tentacle3", basePower: 15, range: 2.6, cooldown: 3, aoeRadius: 1.3, flags: ["morph"], blurb: "Arms take a circle and tighten it.", animationKey: "tentacle_whip" },
    { template: "sucker_yank", noun: "Yank", type: "melee", motion: "yank", gate: "tentacle1", basePower: 14, range: 3, cooldown: 2, flags: ["morph"], blurb: "A hold, and then the held thing is asked to come closer.", animationKey: "tentacle_whip" },
    { template: "claw_arc", noun: "Rake", type: "melee", motion: "arc", gate: "claw", basePower: 14, range: 1.5, cooldown: 3, hits: 2, flags: ["morph"], blurb: "The claw draws an arc, and the arc is the wound.", animationKey: "claw_arc" },
    { template: "talon_dive", noun: "Stoop", type: "melee", motion: "charge", gate: "claw", basePower: 18, range: 2.8, cooldown: 2, flags: ["morph"], blurb: "Height is spent all at once, points first.", animationKey: "claw_arc" },
    { template: "scythe_crescent", noun: "Crescent", type: "melee", motion: "arc", gate: "heavyClaw", basePower: 16, range: 1.8, cooldown: 2, aoeRadius: 1.2, flags: ["morph"], blurb: "A heavy claw keeps its edge through the whole curve.", animationKey: "claw_arc" },
    { template: "pincer_shear", noun: "Clasp", type: "melee", motion: "bite", gate: "heavyClaw", basePower: 18, range: 1.3, cooldown: 2, flags: ["morph"], blurb: "The two edges meet and do not discuss it.", animationKey: "claw_arc" },
    { template: "mandible_shear", noun: "Shear", type: "melee", motion: "bite", gate: "mandible", basePower: 18, range: 1.2, cooldown: 2, flags: ["morph"], blurb: "Mandibles close on a line no wider than a thought.", animationKey: "jaw_snap" },
    { template: "fang_bite", noun: "Bite", type: "melee", motion: "bite", gate: "fang", basePower: 16, range: 1.2, cooldown: 2, flags: ["morph"], blurb: "The fangs set, and only then is the jaw allowed to finish.", animationKey: "jaw_snap" },
    { template: "needle_pierce", noun: "Pierce", type: "melee", motion: "sting", gate: "fang", basePower: 15, range: 1.4, cooldown: 2, flags: ["morph"], blurb: "A point, not a mouthful.", animationKey: "jaw_snap" },
    { template: "grind_chew", noun: "Grind", type: "melee", motion: "grind", gate: "mandible", basePower: 13, range: 1.1, cooldown: 3, hits: 2, flags: ["morph"], blurb: "The jaw works twice. Patient, and not lovely.", animationKey: "jaw_snap" },
    { template: "tail_swipe", noun: "Reap", type: "melee", motion: "arc", gate: "tail", basePower: 16, range: 2.2, cooldown: 2, aoeRadius: 1.1, flags: ["morph"], blurb: "The tail takes the ground at the body's flank.", animationKey: "tail_swipe" },
    { template: "tail_sting", noun: "Sting", type: "dot", motion: "sting", gate: "sting", basePower: 12, range: 2.2, cooldown: 3, flags: ["morph", "venom"], blurb: "What remains in the wound keeps its own small hours.", animationKey: "tail_swipe" },
    { template: "tail_cyclone", noun: "Cyclone", type: "slam", motion: "cyclone", gate: "tail", basePower: 16, range: 2.4, cooldown: 3, aoeRadius: 1.8, flags: ["morph"], blurb: "The tail turns until the air has to follow.", animationKey: "tail_swipe" },
    { template: "tail_club", noun: "Bludgeon", type: "slam", motion: "slam", gate: "tail", basePower: 18, range: 1.8, cooldown: 3, aoeRadius: 1.2, flags: ["morph"], blurb: "The heavy end is lifted, and then it is not.", animationKey: "tail_swipe" },
    { template: "wing_buffet", noun: "Buffet", type: "slam", motion: "wing", gate: "wing", basePower: 15, range: 2.8, cooldown: 3, aoeRadius: 2.2, flags: ["morph", "aerial"], blurb: "One beat, and a sheet of air leaves the body.", animationKey: "wing_flap" },
    { template: "feather_hail", noun: "Hail", type: "projectile", motion: "rain", gate: "wing", basePower: 16, range: 6, cooldown: 3, aoeRadius: 1.3, flags: ["morph", "aerial"], blurb: "The wing gives up a little of its edge, on purpose.", animationKey: "wing_flap" },
    { template: "pinion_shear", noun: "Pinion", type: "melee", motion: "arc", gate: "wing", basePower: 16, range: 2.2, cooldown: 2, flags: ["morph", "aerial"], blurb: "The leading edge is used as a blade.", animationKey: "wing_flap" },
    { template: "wing_plunge", noun: "Plunge", type: "melee", motion: "charge", gate: "wing", basePower: 18, range: 3, cooldown: 2, flags: ["morph", "aerial"], blurb: "The wings fold. The body is the remaining argument.", animationKey: "wing_flap" },
    { template: "fin_rush", noun: "Rush", type: "melee", motion: "charge", gate: "fin", basePower: 15, range: 2.4, cooldown: 2, flags: ["morph"], blurb: "The fins set, and the whole animal becomes a direction.", animationKey: "tail_swipe" },
    { template: "fin_vortex", noun: "Eddy", type: "slam", motion: "vortex", gate: "fin", basePower: 15, range: 2.6, cooldown: 3, aoeRadius: 1.5, flags: ["morph"], blurb: "Water is taken in a ring and then let go.", animationKey: "tail_swipe" },
    { template: "surface_shard", noun: "Shards", type: "projectile", motion: "volley", gate: "armorhide", basePower: 17, range: 6, cooldown: 3, flags: ["morph"], blurb: "The hide sheds what it can spare and still remain a hide.", animationKey: "surface_shard" },
    { template: "plate_slam", noun: "Ram", type: "slam", motion: "charge", gate: "armorhide", basePower: 18, range: 1.6, cooldown: 3, aoeRadius: 1.2, flags: ["morph"], blurb: "The plate is offered first. The body follows it.", animationKey: "body_charge" },
    { template: "scale_storm", noun: "Molt", type: "projectile", motion: "rain", gate: "armorhide", basePower: 15, range: 5.5, cooldown: 3, aoeRadius: 1.4, flags: ["morph"], blurb: "Scales lift, turn, and travel a short honest distance.", animationKey: "surface_shard" },
    { template: "breath_stream", noun: "Stream", type: "breath", motion: "stream", gate: "breath", basePower: 24, range: 7, cooldown: 4, flags: ["elemental"], blurb: "A breath held in one line until the body decides it is finished.", animationKey: "breath_stream" },
    { template: "breath_cone", noun: "Cone", type: "breath", motion: "cone", gate: "breath", basePower: 22, range: 4.2, cooldown: 4, aoeRadius: 1.8, flags: ["elemental"], blurb: "The breath opens, because it has room to.", animationKey: "breath_cone" },
    { template: "breath_burst", noun: "Burst", type: "breath", motion: "burst", gate: "breath", basePower: 22, range: 2.6, cooldown: 4, aoeRadius: 2.4, flags: ["elemental"], blurb: "All of the breath, with no remainder saved.", animationKey: "breath_burst" },
    { template: "breath_helix", noun: "Helix", type: "breath", motion: "spiral", gate: "breath", basePower: 22, range: 6, cooldown: 4, aoeRadius: 1.2, flags: ["elemental"], blurb: "The breath takes a screw, so it stays itself a little longer.", animationKey: "breath_stream" },
    { template: "breath_mist", noun: "Brume", type: "breath", motion: "brume", gate: "breath", basePower: 16, range: 4, cooldown: 3, aoeRadius: 2, flags: ["elemental"], blurb: "A quiet breath that fills a volume instead of striking a point.", animationKey: "breath_cone" },
    { template: "body_charge", noun: "Charge", type: "slam", motion: "charge", gate: "any", basePower: 16, range: 1.6, cooldown: 3, flags: [], blurb: "The whole body is the weapon, and it agrees to be.", animationKey: "body_charge" },
    { template: "ground_pound", noun: "Pound", type: "slam", motion: "slam", gate: "any", basePower: 16, range: 1.8, cooldown: 3, aoeRadius: 1.8, flags: [], blurb: "Weight is given to the ground, and the ground returns some of it.", animationKey: "body_charge" },
    { template: "shoulder_check", noun: "Check", type: "melee", motion: "thrust", gate: "any", basePower: 14, range: 1.4, cooldown: 2, flags: [], blurb: "A shoulder. Nothing more theatrical than that.", animationKey: "body_charge" },
    { template: "dual_cast", noun: "Twin", type: "special", motion: "spiral", gate: "dual", basePower: 22, range: 5, cooldown: 4, aoeRadius: 1.2, flags: ["dual", "priority", "elemental"], blurb: "Two elements leave at once and do not dilute one another.", animationKey: "breath_burst" },
    { template: "basic_bite", noun: "Nip", type: "melee", motion: "bite", gate: "bite", basePower: 12, range: 1.1, cooldown: 2, flags: ["fallback"], blurb: "A plain bite. Enough, when nothing else is offered.", animationKey: "jaw_snap" },
    { template: "organ_pulse", noun: "Wake", type: "special", motion: "wing", gate: "organ", basePower: 20, range: 4.5, cooldown: 4, flags: ["ascent"], blurb: "The ascent organ unfurls and throws a pressure wave.", animationKey: "organ_activate", organ: "wings" },
    { template: "organ_pulse", noun: "Plume", type: "special", motion: "stream", gate: "organ", basePower: 20, range: 4.5, cooldown: 4, flags: ["ascent"], blurb: "Dorsal vents open and throw a charged plume.", animationKey: "organ_activate", organ: "vents" },
    { template: "organ_pulse", noun: "Draught", type: "special", motion: "yank", gate: "organ", basePower: 20, range: 4.5, cooldown: 4, flags: ["ascent"], blurb: "The siphon draws, then expels a compressed draught.", animationKey: "organ_activate", organ: "siphon" },
    { template: "organ_pulse", noun: "Bloom", type: "special", motion: "cone", gate: "organ", basePower: 20, range: 4.5, cooldown: 4, flags: ["ascent"], blurb: "Membrane sails snap full and shed a cutting sheet.", animationKey: "organ_activate", organ: "sails" },
    { template: "organ_pulse", noun: "Drop", type: "special", motion: "slam", gate: "organ", basePower: 20, range: 4.5, cooldown: 4, flags: ["ascent"], blurb: "The levitator lets go. Bent air drops as weight.", animationKey: "organ_activate", organ: "levitator" },
    { template: "relic_invoke", noun: "Idol", type: "slam", motion: "slam", gate: "relic", basePower: 18, range: 1.8, cooldown: 3, flags: ["relic"], blurb: "The relic comes down with the weight of the one who holds it.", animationKey: "relic_use", relicUse: "smash" },
    { template: "relic_invoke", noun: "Gauntlet", type: "slam", motion: "chain", gate: "relic", basePower: 18, range: 1.8, cooldown: 3, flags: ["relic"], blurb: "The relic is worn on the limbs and makes the next blow heavier.", animationKey: "relic_use", relicUse: "brawl" },
    { template: "relic_invoke", noun: "Reach", type: "melee", motion: "thrust", gate: "relic", basePower: 18, range: 4.5, cooldown: 3, flags: ["relic"], blurb: "The relic strikes past the reach of the limbs.", animationKey: "relic_use", relicUse: "reach" },
    { template: "relic_invoke", noun: "Banner", type: "projectile", motion: "cone", gate: "relic", basePower: 18, range: 4.5, cooldown: 3, flags: ["relic"], blurb: "The relic raises a cutting gust.", animationKey: "relic_use", relicUse: "gust" },
    { template: "relic_invoke", noun: "Lamp", type: "special", motion: "burst", gate: "relic", basePower: 18, range: 1.8, cooldown: 3, flags: ["relic"], blurb: "The relic kindles and throws a hard light.", animationKey: "relic_use", relicUse: "light" },
    { template: "relic_invoke", noun: "Lens", type: "special", motion: "thrust", gate: "relic", basePower: 18, range: 1.8, cooldown: 3, flags: ["relic"], blurb: "The relic gathers the element's charge into one point.", animationKey: "relic_use", relicUse: "focus" },
    { template: "relic_invoke", noun: "Anchor", type: "special", motion: "pulse", gate: "relic", basePower: 18, range: 1.8, cooldown: 3, flags: ["relic"], blurb: "The relic plants, and sends a shock through the ground.", animationKey: "relic_use", relicUse: "steady" },
    { template: "relic_invoke", noun: "Buckler", type: "special", motion: "wall", gate: "relic", basePower: 18, range: 1.8, cooldown: 3, flags: ["relic"], blurb: "The relic flares a ward, and then it answers.", animationKey: "relic_use", relicUse: "guard" }
  ];
  function fieldHash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function title(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }
  function buildAttacks() {
    const out = [];
    for (const form of FORMS) {
      for (const element of ELEMENTS) {
        for (const manner of MANNERS) {
          const id = `${form.template}:${form.organ ?? ""}:${form.relicUse ?? ""}:${element}:${manner}`;
          const adj = ADJ[element] ?? title(element);
          out.push({
            id,
            template: form.template,
            name: `${MANNER_ADJ[manner]} ${adj} ${form.noun}`,
            type: form.type,
            element,
            manner,
            motion: form.motion,
            animationKey: form.animationKey,
            effectStyle: `${form.motion}-${manner}`,
            fxSeed: fieldHash(id),
            basePower: form.basePower,
            range: form.range,
            cooldown: form.cooldown,
            aoeRadius: form.aoeRadius,
            hits: form.hits,
            flags: form.flags,
            description: `${form.blurb} ${ELEMENT_LINE[element] ?? ""} ${MANNER_LINE[manner]}`.trim(),
            gate: form.gate,
            organ: form.organ,
            relicUse: form.relicUse,
            noun: form.noun
          });
        }
      }
    }
    return out;
  }
  var ATTACK_LEXICON = buildAttacks();
  var ATTACK_INDEX = /* @__PURE__ */ new Map();
  for (const tech of ATTACK_LEXICON) {
    ATTACK_INDEX.set(`${tech.template}|${tech.element}|${tech.manner}|${tech.organ ?? ""}|${tech.relicUse ?? ""}`, tech);
  }
  function matchVariant(q) {
    return ATTACK_INDEX.get(`${q.template}|${q.element}|${q.manner}|${q.organ ?? ""}|${q.relicUse ?? ""}`);
  }
  function motionForAnimation(key) {
    const found = ATTACK_LEXICON.find((t) => t.animationKey === key);
    return found?.motion ?? "burst";
  }
  var COVERINGS = ["skin", "fur", "feather", "scale", "chitin", "bark", "slime", "shell", "plate"];
  var COVER_NOUN = {
    skin: "Hide",
    fur: "Pelt",
    feather: "Plumage",
    scale: "Mail",
    chitin: "Cuirass",
    bark: "Cortex",
    slime: "Sheath",
    shell: "Shell",
    plate: "Plate"
  };
  var MASS_NAME = { light: "Veil", medium: "Mantle", heavy: "Bastion" };
  var ORGAN_NOUN = {
    wings: "Wake",
    vents: "Plume",
    siphon: "Draught",
    sails: "Bloom",
    levitator: "Drop"
  };
  var RELIC_MATTER = ["wood", "bone", "stone", "metal", "crystal", "ice", "chitin"];
  var MATTER_WORD = {
    wood: "Greenwood",
    bone: "Ossuary",
    stone: "Lithic",
    metal: "Ferrous",
    crystal: "Lucent",
    ice: "Hyaline",
    chitin: "Sclerite"
  };
  var RELIC_USES = [
    { use: "smash", noun: "Idol" },
    { use: "brawl", noun: "Gauntlet" },
    { use: "reach", noun: "Reach" },
    { use: "gust", noun: "Banner" },
    { use: "light", noun: "Lamp" },
    { use: "focus", noun: "Lens" },
    { use: "steady", noun: "Anchor" },
    { use: "guard", noun: "Buckler" }
  ];
  function ward(partial) {
    return { ...partial, fxSeed: partial.fxSeed ?? fieldHash(partial.id) };
  }
  function buildWards() {
    const out = [];
    for (const covering of COVERINGS) {
      for (const element of ELEMENTS) {
        for (const mass of ["light", "medium", "heavy"]) {
          const adj = ADJ[element];
          const id = `hide:${covering}:${element}:${mass}`;
          out.push(
            ward({
              id,
              family: "carapace",
              name: `${MASS_NAME[mass]} ${adj} ${COVER_NOUN[covering]}`,
              element,
              mass,
              covering,
              motion: "aegis",
              description: `The ${covering} is ${adj.toLowerCase()} and ${mass}. It turns aside a share of each blow. The rest still arrives.`,
              value: mass === "heavy" ? 0.16 : mass === "medium" ? 0.1 : 0.06
            })
          );
        }
      }
    }
    for (const element of ELEMENTS) {
      const adj = ADJ[element];
      for (const [grade, word, value] of [
        ["sparse", "Sparse", 0.06],
        ["thick", "Thick", 0.1],
        ["barbed", "Barbed", 0.12]
      ]) {
        out.push(
          ward({
            id: `thorns:${element}:${grade}`,
            family: "thorns",
            name: `${word} ${adj} Thorn`,
            element,
            grade,
            motion: "thorn",
            description: `${word} ${adj.toLowerCase()} points return a little of a blow that lands. Not the blow. A little.`,
            value
          })
        );
      }
      for (const [grade, word] of [
        ["slow", "Slow"],
        ["deep", "Deep"],
        ["bright", "Bright"]
      ]) {
        out.push(
          ward({
            id: `knit:${element}:${grade}`,
            family: "sap-knit",
            name: `${word} ${adj} Knit`,
            element,
            grade,
            motion: "knit",
            description: `${word} ${adj.toLowerCase()} tissue closes a little over a shallow wound, and then it stops.`,
            value: 0.05
          })
        );
      }
      for (const [grade, word] of [
        ["soft", "Soft"],
        ["sheer", "Sheer"],
        ["wild", "Wild"]
      ]) {
        out.push(
          ward({
            id: `slip:${element}:${grade}`,
            family: "slip",
            name: `${word} ${adj} Slip`,
            element,
            grade,
            motion: "slip",
            description: `A ${word.toLowerCase()} ${adj.toLowerCase()} slip sheds a shove instead of taking it.`,
            value: 0.2
          })
        );
      }
      out.push(
        ward({
          id: `immovable:${element}`,
          family: "immovable",
          name: `${adj} Immovable`,
          element,
          motion: "aegis",
          description: `${adj} mass gives ground slowly. It can still be moved. It prefers not.`,
          value: 0.7
        })
      );
      out.push(
        ward({
          id: `mucus:${element}`,
          family: "mucus",
          name: `${adj} Mucus`,
          element,
          motion: "aegis",
          description: `A ${adj.toLowerCase()} coat shrugs a little water and clings to what strikes it.`,
          value: 0.12
        })
      );
      out.push(
        ward({
          id: `temper:${element}`,
          family: "temper",
          name: `${adj} Temper`,
          element,
          motion: "aegis",
          description: `The body is ${adj.toLowerCase()} in its temper. What matches it bites less. What opposes it bites more.`,
          value: 0.2
        })
      );
      for (const [organ, noun] of Object.entries(ORGAN_NOUN)) {
        out.push(
          ward({
            id: `organ:${organ}:${element}`,
            family: "ascent-ward",
            name: `${noun} ${adj} Ward`,
            element,
            organ,
            motion: "aegis",
            description: `The ${organ} holds a ${adj.toLowerCase()} ward while it is quiet.`,
            value: 0.08
          })
        );
      }
    }
    for (const matter of RELIC_MATTER) {
      for (const relic of RELIC_USES) {
        const element = matter === "wood" ? "plant" : matter === "bone" || matter === "chitin" ? "beast" : matter === "ice" ? "ice" : matter === "metal" ? "metal" : "earth";
        out.push(
          ward({
            id: `relic:${matter}:${relic.use}`,
            family: "relic-aegis",
            name: `${MATTER_WORD[matter]} ${relic.noun}`,
            element,
            relicMatter: matter,
            relicUse: relic.use,
            motion: relic.use === "guard" ? "aegis" : "aegis",
            description: `The ${matter} ${relic.use} answers when the body is pressed. It is an answer, not a refusal.`,
            value: 0.08
          })
        );
      }
    }
    return out;
  }
  var WARD_LEXICON = buildWards();
  var WARD_BY_FAMILY = /* @__PURE__ */ new Map();
  for (const w of WARD_LEXICON) {
    const list = WARD_BY_FAMILY.get(w.family) ?? [];
    list.push(w);
    WARD_BY_FAMILY.set(w.family, list);
  }
  function wardPresentation(family, hints) {
    const list = WARD_BY_FAMILY.get(family);
    if (!list?.length) return void 0;
    const element = hints.element || "beast";
    const mass = hints.mass ?? "medium";
    const grade = mass === "light" ? "sparse" : mass === "heavy" ? "thick" : "barbed";
    const knitGrade = mass === "light" ? "slow" : mass === "heavy" ? "deep" : "bright";
    const slipGrade = mass === "light" ? "soft" : mass === "heavy" ? "wild" : "sheer";
    return list.find((w) => {
      if (w.element !== element && family !== "relic-aegis") return false;
      if (family === "carapace") return w.covering === (hints.covering ?? "skin") && w.mass === mass;
      if (family === "thorns") return w.grade === grade;
      if (family === "sap-knit") return w.grade === knitGrade;
      if (family === "slip") return w.grade === slipGrade;
      if (family === "ascent-ward") return w.organ === hints.organ;
      if (family === "relic-aegis") return w.relicMatter === hints.relicMatter && w.relicUse === hints.relicUse;
      return true;
    }) ?? list.find((w) => w.element === element) ?? list[0];
  }

  // primordia-specimen-lab/combat/tables.ts
  var BUILD_MASS = {
    medium: 1,
    light: 0.82,
    heavy: 1.28,
    lithe: 0.76,
    runner: 0.84,
    dancer: 0.8,
    stalker: 0.9,
    wraith: 0.68,
    ascetic: 0.86,
    sage: 0.96,
    herald: 1.04,
    guardian: 1.24,
    brawler: 1.16,
    titan: 1.42,
    colossus: 1.6
  };
  var COVERING_ARMOR = {
    skin: 0.04,
    fur: 0.09,
    feather: 0.05,
    scale: 0.22,
    chitin: 0.34,
    bark: 0.26,
    slime: 0.05,
    shell: 0.5,
    plate: 0.42
  };
  var ELEMENT_RESIST = {
    plant: { plant: 0.4, water: 0.15, earth: 0.1, fire: -0.28, ice: -0.08 },
    fire: { fire: 0.45, ice: 0.15, plant: 0.2, water: -0.32, earth: -0.06 },
    water: { water: 0.45, fire: 0.28, ice: 0.08, electric: -0.34 },
    earth: { earth: 0.42, electric: 0.12, air: -0.18, water: -0.1, plant: 0.06 },
    ice: { ice: 0.45, water: 0.12, fire: -0.3, plasma: -0.16 },
    electric: { electric: 0.4, air: 0.1, water: -0.12, earth: -0.22 },
    plasma: { plasma: 0.4, fire: 0.2, water: -0.28, earth: -0.08 },
    air: { air: 0.35, electric: 0.08, earth: -0.16, ice: 0.06 },
    metal: { metal: 0.4, earth: 0.12, electric: -0.3, fire: 0.06 },
    light: { light: 0.4, fire: 0.06, void: -0.28 },
    void: { void: 0.42, beast: 0.08, light: -0.3 },
    beast: { beast: 0.2, plant: 0.05, metal: -0.12 }
  };
  var LARGE_BUILDS = /* @__PURE__ */ new Set(["titan", "colossus", "guardian", "brawler", "heavy"]);
  function isLargeBuild(build, sizeM) {
    return LARGE_BUILDS.has(build ?? "") || sizeM >= 2.6;
  }

  // primordia-specimen-lab/combat/generate.ts
  var NOUN = {
    spike_volley: "Volley",
    horn_thrust: "Gore",
    spine_barrage: "Barrage",
    tentacle_slam: "Crush",
    tentacle_whip: "Lash",
    claw_arc: "Rake",
    mandible_shear: "Shear",
    fang_bite: "Bite",
    basic_bite: "Nip",
    tail_swipe: "Sweep",
    tail_sting: "Sting",
    wing_buffet: "Buffet",
    fin_rush: "Rush",
    surface_shard: "Shards",
    breath_stream: "Stream",
    breath_cone: "Cone",
    breath_burst: "Burst",
    body_charge: "Charge",
    dual_cast: "Twin",
    organ_pulse: "Organ",
    relic_invoke: "Relic"
  };
  var ORGAN_NAME = {
    wings: "Pinion Wake",
    vents: "Vent Flare",
    siphon: "Siphon Draught",
    sails: "Sail Bloom",
    levitator: "Gravetic Drop"
  };
  var USE_TYPE = {
    smash: "slam",
    brawl: "slam",
    reach: "melee",
    gust: "projectile",
    light: "special",
    focus: "special",
    steady: "special",
    guard: "special"
  };
  var MATTER_ELEMENT = {
    wood: "plant",
    bone: "beast",
    stone: "earth",
    metal: "metal",
    crystal: "earth",
    ice: "ice",
    chitin: "beast"
  };
  function statMul(value) {
    if (value == null || !Number.isFinite(value)) return 1;
    if (value > 3) return 0.7 + Math.min(100, Math.max(0, value)) / 100 * 0.7;
    return Math.max(0.15, value);
  }
  function massFactorOf(sizeM, build) {
    const key = build && BUILD_MASS[build] != null ? build : "medium";
    return Math.pow(Math.max(0.15, sizeM), 0.65) * BUILD_MASS[key];
  }
  function massClassOf(factor) {
    if (factor < 1.05) return "light";
    if (factor < 1.85) return "medium";
    return "heavy";
  }
  function combatScale(factor) {
    return Math.pow(Math.max(0.35, factor), 0.26);
  }
  function techniqueBorne(ph, tech) {
    const element = ph.element || "beast";
    if (tech.element !== element && tech.element !== ph.element2) return false;
    const horns = countUnits(ph, "horn", "horns");
    const tentacles = countUnits(ph, "tentacle", "tentacles");
    const wings = countUnits(ph, "wing", "wings");
    const tails = countUnits(ph, "tail", "tails");
    const fins = countUnits(ph, "fin", "fins");
    const spines = countUnits(ph, "spine", "quill") + (hasFeature(ph, /quill|spine|spike/) ? 1 : 0);
    const sculpture = ph.shell?.sculpture ?? [];
    const spiny = sculpture.some((s) => s === "spines" || s === "knobs");
    const covering = ph.covering?.type ?? "skin";
    const sting = hasFeature(ph, /sting|manticore/) || ph.units.some((u) => /sting/.test(u.role ?? ""));
    switch (tech.gate) {
      case "any":
      case "breath":
      case "bite":
        return true;
      case "horn1":
        return horns >= 1;
      case "horn2":
        return horns >= 2;
      case "spine":
        return spines > 0;
      case "tentacle1":
        return tentacles >= 1;
      case "tentacle3":
        return tentacles >= 3;
      case "claw":
        return clawish(ph.claws);
      case "heavyClaw":
        return /pincer|scythe/.test(ph.claws ?? "");
      case "mandible":
        return countUnits(ph, "mandible") > 0 || hasFeature(ph, /mandible/);
      case "fang":
        return hasFeature(ph, /fang|carnass|serrat|needle/);
      case "tail":
        return tails > 0;
      case "sting":
        return sting && tails > 0;
      case "wing":
        return wings > 0;
      case "fin":
        return fins >= 2 && (ph.loco === "Swim" || ph.loco === "Hover");
      case "armorhide":
        return ["shell", "plate", "chitin", "scale"].includes(covering) || spiny;
      case "dual":
        return !!ph.element2 && ph.element2 !== element;
      case "organ":
        return ph.ascent?.organ === tech.organ;
      case "relic":
        return ph.ascent?.relic?.use === tech.relicUse;
      default:
        return false;
    }
  }
  function mannerFor(ph) {
    const mass = massClassOf(massFactorOf(ph.sizeM, ph.build));
    if (mass === "heavy") return "charged";
    if (mass === "light") return "quick";
    if (hasFeature(ph, /sting|manticore|venom/) || ph.element === "plant") return "echoing";
    return "measured";
  }
  function wear(ph, attack, manner) {
    const tech = matchVariant({
      template: attack.template,
      element: attack.element,
      manner,
      organ: attack.template === "organ_pulse" ? ph.ascent?.organ : void 0,
      relicUse: attack.template === "relic_invoke" ? ph.ascent?.relic?.use : void 0
    });
    const flags = [...attack.flags];
    let cooldown = attack.cooldown;
    let mul = 1;
    if (manner === "quick" && cooldown >= 3) {
      const next = cooldown - 1;
      mul = next / cooldown;
      cooldown = next;
    } else if (manner === "charged") {
      const next = cooldown + 1;
      mul = next / cooldown;
      cooldown = next;
    } else if (manner === "echoing" && attack.type !== "dot" && !flags.includes("echo")) {
      mul = 0.88;
      flags.push("echo");
    }
    return {
      ...attack,
      name: tech?.name ?? attack.name,
      description: tech?.description ?? attack.description,
      effectStyle: tech?.effectStyle ?? attack.effectStyle,
      power: Math.max(1, Math.round(attack.power * mul)),
      cooldown,
      flags,
      manner,
      variantId: tech?.id ?? `${attack.template}:${attack.element}:${manner}`,
      fxMotion: tech?.motion ?? motionForAnimation(attack.animationKey),
      fxSeed: tech?.fxSeed ?? fieldHash(`${attack.template}:${attack.element}:${manner}`)
    };
  }
  function compressKit(attacks, mass) {
    if (!attacks.length) return;
    const avg = attacks.reduce((sum, a) => sum + expectedThreat(a), 0) / attacks.length;
    const ceiling = mass === "light" ? 16 : mass === "heavy" ? 26 : 20;
    const floor = mass === "light" ? 8 : mass === "heavy" ? 12 : 10;
    if (avg <= ceiling && avg >= floor) return;
    const scale = (avg > ceiling ? ceiling : floor) / avg;
    for (const attack of attacks) {
      attack.power = Math.max(1, Math.round(attack.power * scale));
      attack.basePower = Math.max(1, Math.round(attack.basePower * scale));
    }
  }
  function clamp2(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }
  function round2(n) {
    return Math.round(n * 100) / 100;
  }
  function title2(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }
  function countUnits(ph, ...names) {
    let n = 0;
    for (const u of ph.units) {
      const unit = (u.unit || "").toLowerCase();
      const role = (u.role || "").toLowerCase();
      if (names.includes(unit) || names.includes(role)) n += u.count ?? 1;
    }
    return n;
  }
  function hasFeature(ph, re) {
    return (ph.features ?? []).some((f) => re.test(f));
  }
  function clawish(claws) {
    if (!claws || claws === "none") return false;
    return /claw|talon|pincer|scythe|hook/.test(claws);
  }
  function breathStyle(ph) {
    if (ph.ascent?.organ) return "breath_burst";
    if (countUnits(ph, "crest") > 0) return "breath_cone";
    if (isLargeBuild(ph.build, ph.sizeM)) return "breath_stream";
    const el2 = ph.element;
    if (el2 === "fire" || el2 === "plasma" || el2 === "electric" || el2 === "water") return "breath_stream";
    if (el2 === "ice" || el2 === "air" || el2 === "plant" || el2 === "light") return "breath_cone";
    return "breath_burst";
  }
  function named(template, element, override) {
    if (override) return override;
    const adj = ADJ[element] ?? title2(element);
    const noun = NOUN[template] ?? title2(template);
    return `${adj} ${noun}`;
  }
  function describe(d, ph) {
    if (d.description) return d.description;
    const el2 = d.element;
    switch (d.template) {
      case "spike_volley":
        return `Horns loose a volley of ${el2} spikes. The weight of the body carries them.`;
      case "horn_thrust":
        return `A single horn drives forward in a ${el2} thrust.`;
      case "spine_barrage":
        return `Spines along the back loose a short ${el2} barrage.`;
      case "tentacle_slam":
        return `The tentacles come down together and pin what they strike.`;
      case "tentacle_whip":
        return `A tentacle cracks outward, longer than the body is.`;
      case "claw_arc": {
        const label = (ph.claws ?? "claws").replaceAll("_", " ");
        return `A ${label} cuts a ${el2} arc.`;
      }
      case "mandible_shear":
        return `Mandibles close like shears.`;
      case "fang_bite":
        return `Fangs set and then bite through.`;
      case "basic_bite":
        return `A plain bite. Enough, when the body has no other weapon.`;
      case "tail_swipe":
        return `The tail sweeps the ground at the body's flank.`;
      case "tail_sting":
        return `The tail plants a sting that keeps working after the blow.`;
      case "wing_buffet":
        return `The wings beat once and throw a sheet of air.`;
      case "fin_rush":
        return `A rush on the fins, shoulder-first through the water.`;
      case "surface_shard":
        return `The hide sheds ${el2} shards. Heavier bodies throw more of them.`;
      case "breath_stream":
        return `A sustained ${el2} breath, held in a stream.`;
      case "breath_cone":
        return `A ${el2} breath that opens into a cone.`;
      case "breath_burst":
        return `A short ${el2} breath, spent all at once.`;
      case "body_charge":
        return `The whole body is the weapon. Heavier builds arrive slower and hit harder.`;
      case "dual_cast":
        return `${title2(ph.element)} and ${title2(ph.element2 ?? el2)} leave the body together.`;
      case "organ_pulse":
        return `The ascent organ discharges.`;
      case "relic_invoke":
        return `The relic is used as the body knows how.`;
      default:
        return `A ${d.type} wrought from the ${el2} of the body.`;
    }
  }
  function push(out, d) {
    out.push(d);
  }
  function generateAttacks(ph) {
    const element = ph.element || "beast";
    const drafts = [];
    const horns = countUnits(ph, "horn", "horns");
    const tentacles = countUnits(ph, "tentacle", "tentacles");
    const wings = countUnits(ph, "wing", "wings");
    const tails = countUnits(ph, "tail", "tails");
    const fins = countUnits(ph, "fin", "fins");
    const spines = countUnits(ph, "spine", "quill") + (hasFeature(ph, /quill|spine|spike/) ? 1 : 0);
    const sculpture = ph.shell?.sculpture ?? [];
    const spinyShell = sculpture.some((s) => s === "spines" || s === "knobs");
    const covering = ph.covering?.type ?? "skin";
    const level = ph.ascent?.level ?? 0;
    if (horns >= 2) {
      push(drafts, {
        template: "spike_volley",
        type: "projectile",
        element,
        basePower: 22 + Math.min(8, horns * 2),
        range: 8,
        cooldown: 3,
        aoeRadius: 1.1,
        animationKey: "horn_thrust",
        effectStyle: "shard-fan",
        flags: ["morph"],
        priority: 0
      });
    } else if (horns === 1) {
      push(drafts, {
        template: "horn_thrust",
        type: "melee",
        element,
        basePower: 20,
        range: 1.6,
        cooldown: 2,
        animationKey: "horn_thrust",
        effectStyle: "thrust",
        flags: ["morph"],
        priority: 0
      });
    }
    if (spines > 0) {
      push(drafts, {
        template: "spine_barrage",
        type: "projectile",
        element,
        basePower: 18 + Math.min(6, spines),
        range: 7,
        cooldown: 3,
        aoeRadius: 1.2,
        animationKey: "surface_shard",
        effectStyle: "shards",
        flags: ["morph"],
        priority: 0
      });
    }
    if (tentacles >= 1) {
      push(drafts, {
        template: "tentacle_slam",
        type: "slam",
        element,
        basePower: 16 + tentacles * 2,
        range: round2(2.2 + tentacles * 0.12),
        cooldown: 3,
        hits: Math.min(3, tentacles),
        animationKey: "tentacle_chain_slam",
        effectStyle: "chain",
        flags: ["morph"],
        priority: 0
      });
    }
    if (tentacles >= 3) {
      push(drafts, {
        template: "tentacle_whip",
        type: "melee",
        element,
        basePower: 14 + tentacles,
        range: 3.2,
        cooldown: 2,
        animationKey: "tentacle_whip",
        effectStyle: "lash",
        flags: ["morph"],
        priority: 0
      });
    }
    if (clawish(ph.claws)) {
      const heavyClaw = /pincer|scythe/.test(ph.claws ?? "");
      push(drafts, {
        template: "claw_arc",
        type: "melee",
        element,
        basePower: heavyClaw ? 22 : 18,
        range: 1.5,
        cooldown: 2,
        hits: 2,
        animationKey: "claw_arc",
        effectStyle: "slash",
        flags: ["morph"],
        priority: 0
      });
    }
    const mouthless = ph.mouth === "none" || ph.mouths === 0;
    const grazer = ph.diet === "herbivore" || ph.diet === "photosynth" || ph.diet === "lithotroph" || ph.diet === "filter" || ph.diet === "detritivore" || ph.diet === "none";
    const biter = ph.diet === "carnivore" || ph.diet === "insectivore";
    if (!mouthless && !grazer && (countUnits(ph, "mandible") > 0 || hasFeature(ph, /mandible/))) {
      push(drafts, {
        template: "mandible_shear",
        type: "melee",
        element,
        basePower: 20,
        range: 1.2,
        cooldown: 2,
        animationKey: "jaw_snap",
        effectStyle: "shear",
        flags: ["morph"],
        priority: 0
      });
    } else if (!mouthless && !grazer && (biter || hasFeature(ph, /fang|carnass|serrat|needle|conical/))) {
      push(drafts, {
        template: "fang_bite",
        type: "melee",
        element,
        basePower: 16,
        range: 1.2,
        cooldown: 2,
        animationKey: "jaw_snap",
        effectStyle: "bite",
        flags: ["morph"],
        priority: 0
      });
    }
    if (tails > 0) {
      const sting = hasFeature(ph, /sting|manticore/) || ph.units.some((u) => /sting/.test(u.role ?? ""));
      if (sting) {
        push(drafts, {
          template: "tail_sting",
          type: "dot",
          element,
          basePower: 12 + tails,
          range: 2.2,
          cooldown: 3,
          animationKey: "tail_swipe",
          effectStyle: "swipe",
          flags: ["morph", "venom"],
          priority: 0
        });
      }
      push(drafts, {
        template: "tail_swipe",
        type: "melee",
        element,
        basePower: 15 + tails,
        range: 2.2,
        cooldown: 2,
        animationKey: "tail_swipe",
        effectStyle: "swipe",
        flags: ["morph"],
        priority: 0
      });
    }
    if (wings > 0) {
      push(drafts, {
        template: "wing_buffet",
        type: "slam",
        element: ph.element === "void" || ph.element === "air" ? element : "air",
        basePower: 14 + wings,
        range: 2.8,
        cooldown: 3,
        aoeRadius: 2.2,
        animationKey: "wing_flap",
        effectStyle: "flap",
        flags: ["morph", "aerial"],
        priority: 0
      });
    }
    if (fins >= 2 && (ph.loco === "Swim" || ph.loco === "Hover")) {
      push(drafts, {
        template: "fin_rush",
        type: "melee",
        element,
        basePower: 13 + fins,
        range: 2.4,
        cooldown: 2,
        animationKey: "tail_swipe",
        effectStyle: "rush",
        flags: ["morph"],
        priority: 0
      });
    }
    if (["shell", "plate", "chitin", "scale"].includes(covering) || spinyShell) {
      push(drafts, {
        template: "surface_shard",
        type: "projectile",
        element,
        basePower: 16 + Math.round((COVERING_ARMOR[covering] ?? 0.1) * 20),
        range: 6,
        cooldown: 3,
        animationKey: "surface_shard",
        effectStyle: "shards",
        flags: ["morph"],
        priority: 0
      });
    }
    const style = breathStyle(ph);
    const breathRange = style === "breath_stream" ? 7 : style === "breath_cone" ? 4.2 : 2.6;
    push(drafts, {
      template: style,
      type: "breath",
      element,
      basePower: 26,
      range: breathRange,
      cooldown: 4,
      aoeRadius: style === "breath_burst" ? 2.4 : style === "breath_cone" ? 1.8 : void 0,
      animationKey: style,
      effectStyle: style.replace("_", "-"),
      flags: ["elemental"],
      priority: 0
    });
    if (ph.element2 && ph.element2 !== element) {
      push(drafts, {
        template: "dual_cast",
        type: "special",
        element: ph.element2,
        basePower: 24,
        range: 5,
        cooldown: 4,
        animationKey: breathStyle({ ...ph, element: ph.element2, ascent: { ...ph.ascent, organ: void 0 } }),
        effectStyle: "twin",
        flags: ["dual", "priority", "elemental"],
        priority: 2,
        element2: element,
        name: `${ADJ[element] ?? title2(element)}\u2013${ADJ[ph.element2] ?? title2(ph.element2)} Twin`
      });
    }
    if (ph.ascent?.organ) {
      const organ = ph.ascent.organ;
      const high = level >= 3;
      push(drafts, {
        template: "organ_pulse",
        type: "special",
        element,
        basePower: 18 + Math.max(1, level) * 4,
        range: 4.5,
        cooldown: 4,
        animationKey: "organ_activate",
        effectStyle: "organ",
        flags: ["ascent", ...high ? ["priority"] : []],
        priority: high ? 3 : 1,
        name: ORGAN_NAME[organ] ?? `${title2(organ)} Pulse`,
        description: organ === "vents" ? "Dorsal vents open and throw a charged plume." : organ === "siphon" ? "The siphon draws, then expels a compressed draught." : organ === "sails" ? "Membrane sails snap full and shed a cutting sheet." : organ === "levitator" ? "The levitator lets go. Bent air drops as weight." : organ === "wings" ? "The ascent organ unfurls and throws a pressure wave." : "The ascent organ discharges."
      });
    }
    const relic = ph.ascent?.relic;
    if (relic?.kind && relic.use) {
      const matterEl = MATTER_ELEMENT[relic.matter] ?? element;
      push(drafts, {
        template: "relic_invoke",
        type: USE_TYPE[relic.use] ?? "special",
        element: matterEl,
        basePower: 18 + (relic.held ? 4 : 0),
        range: relic.use === "reach" || relic.use === "gust" ? 4.5 : 1.8,
        cooldown: 3,
        animationKey: "relic_use",
        effectStyle: "relic",
        flags: ["relic"],
        priority: 0,
        name: `${title2(relic.kind)} \xB7 ${relic.use}`,
        description: relic.use === "smash" ? "The relic comes down with the weight of the wielder." : relic.use === "gust" ? "The relic raises a cutting gust." : relic.use === "reach" ? "The relic strikes past the reach of the limbs." : relic.use === "brawl" ? "The relic is worn on the limbs and makes the next blow heavier." : relic.use === "guard" ? "The relic flares a ward, then answers." : relic.use === "light" ? "The relic kindles and throws a hard light." : relic.use === "focus" ? "The relic gathers the element's charge into one point." : "The relic plants and sends a shock through the ground."
      });
    }
    const templates = new Set(drafts.map((d) => d.template));
    const weapons = drafts.filter(
      (d) => !d.template.startsWith("breath") && d.template !== "dual_cast" && d.template !== "organ_pulse" && d.template !== "relic_invoke"
    ).length;
    if (weapons < 2 && !templates.has("fang_bite") && !templates.has("mandible_shear") && !templates.has("basic_bite")) {
      push(drafts, {
        template: "basic_bite",
        type: "melee",
        element,
        basePower: 12,
        range: 1.1,
        cooldown: 2,
        animationKey: "jaw_snap",
        effectStyle: "bite",
        flags: ["fallback"],
        priority: 0
      });
    }
    if (weapons < 2 && !templates.has("body_charge")) {
      push(drafts, {
        template: "body_charge",
        type: "slam",
        element,
        basePower: 14,
        range: 1.4,
        cooldown: 3,
        animationKey: "body_charge",
        effectStyle: "charge",
        flags: ["fallback"],
        priority: 0
      });
    }
    drafts.sort(
      (a, b) => b.priority - a.priority || b.basePower - a.basePower || a.template.localeCompare(b.template)
    );
    const kept = drafts.slice(0, 6);
    const factor = massFactorOf(ph.sizeM, ph.build);
    const scale = combatScale(factor);
    const powerMul = statMul(ph.stats?.power);
    const manner = mannerFor(ph);
    const attacks = kept.map((d, i) => {
      const power = Math.max(1, Math.round(d.basePower * scale * powerMul));
      return wear(
        ph,
        {
          id: `${d.template}:${d.element}:${i}`,
          template: d.template,
          name: named(d.template, d.element, d.name),
          type: d.type,
          element: d.element,
          basePower: d.basePower,
          power,
          range: d.range,
          cooldown: d.cooldown,
          aoeRadius: d.aoeRadius,
          hits: d.hits,
          animationKey: d.animationKey,
          effectStyle: d.effectStyle,
          description: describe(d, ph),
          flags: d.flags,
          element2: d.element2
        },
        manner
      );
    });
    compressKit(attacks, massClassOf(factor));
    attacks.sort((a, b) => {
      const ap = a.power + (a.flags.includes("priority") ? 6 : 0);
      const bp = b.power + (b.flags.includes("priority") ? 6 : 0);
      return bp - ap || a.template.localeCompare(b.template);
    });
    return attacks;
  }
  function addResist(map, element, amount) {
    map[element] = round2(clamp2((map[element] ?? 0) + amount, -0.6, 0.75));
  }
  function generateDefense(ph) {
    const covering = ph.covering?.type ?? "skin";
    const factor = massFactorOf(ph.sizeM, ph.build);
    const massClass = massClassOf(factor);
    let material = COVERING_ARMOR[covering] ?? 0.04;
    const sculpture = ph.shell?.sculpture ?? [];
    if (sculpture.includes("spines") || sculpture.includes("knobs")) material += 0.04;
    if (ph.shell && covering !== "shell" && covering !== "plate") material += 0.06;
    if (ph.stats?.guard != null) material *= 0.9 + 0.15 * statMul(ph.stats.guard);
    material = round2(clamp2(material, 0, 0.82));
    const armor = round2(armorCut(material));
    const wings = countUnits(ph, "wing", "wings");
    let knockback = 0.12 + Math.min(0.55, factor * 0.14) + material * 0.28;
    if (massClass === "light" && wings > 0) knockback *= 0.72;
    const knockbackResist = round2(clamp2(knockback, 0.05, 0.94));
    const elementalResist = {};
    const innate = ELEMENT_RESIST[ph.element];
    if (innate) for (const [k, v] of Object.entries(innate)) addResist(elementalResist, k, v);
    if (ph.element2 && ph.element2 !== ph.element && ELEMENT_RESIST[ph.element2]) {
      for (const [k, v] of Object.entries(ELEMENT_RESIST[ph.element2])) addResist(elementalResist, k, v * 0.5);
    }
    if (covering === "fur" || covering === "feather") addResist(elementalResist, "ice", 0.12);
    if (covering === "fur") addResist(elementalResist, "fire", -0.08);
    if (covering === "bark") {
      addResist(elementalResist, "earth", 0.1);
      addResist(elementalResist, "fire", -0.12);
    }
    if (covering === "slime") {
      addResist(elementalResist, "water", 0.12);
      addResist(elementalResist, "fire", -0.1);
    }
    if (covering === "scale") addResist(elementalResist, "fire", 0.06);
    if (covering === "plate" || covering === "shell" || covering === "chitin") addResist(elementalResist, "metal", 0.08);
    if (ph.stats?.spirit != null && ph.element) addResist(elementalResist, ph.element, (statMul(ph.stats.spirit) - 1) * 0.22);
    const vigor = statMul(ph.stats?.vigor);
    const scale = combatScale(factor);
    let hp = Math.max(36, Math.round(92 * scale * (0.84 + 0.26 * vigor) * (1 + material * 0.35)));
    if (ph.massKg) hp = Math.max(36, Math.round(hp * Math.max(0.84, Math.min(1.28, Math.pow(ph.massKg / 48, 0.16)))));
    const specials = [];
    if (covering === "shell" || covering === "plate" || ph.shell) {
      specials.push({
        id: "carapace",
        name: "Carapace",
        description: "The shell or plate turns a share of each blow.",
        value: armor
      });
    }
    if (massClass === "heavy") {
      specials.push({
        id: "immovable",
        name: "Immovable mass",
        description: "A heavy body gives ground slowly.",
        value: knockbackResist
      });
    }
    if (covering === "slime") {
      specials.push({
        id: "mucus",
        name: "Mucus sheath",
        description: "A wet coat shrugs water and clings to what strikes it.",
        value: round2(0.12)
      });
    }
    if (massClass === "light" && wings > 0) {
      specials.push({
        id: "slip",
        name: "Aerial slip",
        description: "Light wings shed a shove instead of taking it.",
        value: round2(1 - knockbackResist)
      });
    }
    if (countUnits(ph, "horn", "spine", "quill") > 0 || sculpture.includes("spines") || hasFeature(ph, /quill|spine/)) {
      specials.push({
        id: "thorns",
        name: "Retaliatory thorns",
        description: "Horns or spines return a little of a blow that lands.",
        value: round2(0.08 + Math.min(0.12, countUnits(ph, "horn", "spine") * 0.02))
      });
    }
    if (ph.ascent?.organ) {
      specials.push({
        id: "ascent-ward",
        name: "Ascent ward",
        description: `The ${ph.ascent.organ} organ holds a ward while it is quiet.`,
        value: round2(0.06 + (ph.ascent.level ?? 1) * 0.03)
      });
    }
    if (ph.ascent?.relic) {
      specials.push({
        id: "relic-aegis",
        name: "Relic aegis",
        description: `The ${ph.ascent.relic.kind} answers when the body is pressed.`,
        value: ph.ascent.relic.held ? 0.12 : 0.06,
        aspect: ph.ascent.relic.use
      });
    }
    if (ph.element) {
      specials.push({
        id: "temper",
        name: "Temper",
        description: "What matches this element bites less. What opposes it bites more.",
        value: 0.2
      });
    }
    if ((covering === "bark" || ph.element === "plant") && (ph.stats?.vigor ?? 1) >= 1) {
      specials.push({
        id: "sap-knit",
        name: "Sap knit",
        description: "Living tissue closes slowly over a shallow wound.",
        value: round2(massClass === "heavy" ? 0.07 : massClass === "light" ? 0.04 : 0.05)
      });
    }
    const weak = Object.entries(elementalResist).filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1])[0];
    const named2 = specials.map((s) => {
      const presented = wardPresentation(s.id, {
        element: ph.element || "beast",
        covering,
        mass: massClass,
        organ: ph.ascent?.organ,
        relicMatter: ph.ascent?.relic?.matter,
        relicUse: ph.ascent?.relic?.use
      });
      return presented ? { ...s, name: presented.name, description: presented.description } : s;
    });
    const notes = [
      `${title2(massClass)} body, ${ph.sizeM.toFixed(2)} m, build ${ph.build ?? "medium"}.`,
      `${title2(covering)} hide turns aside about ${Math.round(armor * 100)}% of a blow.`
    ];
    if (weak) notes.push(`${title2(weak[0])} bites harder than the rest.`);
    if (ph.element2) notes.push(`A second element, ${ph.element2}, shares the ward.`);
    const initiative = ph.stats?.swift != null ? statMul(ph.stats.swift) : void 0;
    const focus = ph.stats?.focus != null ? statMul(ph.stats.focus) : void 0;
    const edge = ph.stats?.power != null ? statMul(ph.stats.power) : void 0;
    const airborne = Boolean(ph.volant) || wings > 0 && massClass === "light";
    const footing = ph.loco === "Sessile" || ph.plan === "sessile_mass" || ph.plan === "sessile_radial" ? "rooted" : "mobile";
    const brace = ph.stats?.guard != null && statMul(ph.stats.guard) >= 1.12 ? 0.1 : void 0;
    const sheet = ph.stats && Object.values(ph.stats).some((v) => v > 3) ? { ...ph.stats } : void 0;
    return { hp, armor, knockbackResist, elementalResist, specials: named2, massClass, notes, initiative, focus, edge, airborne, footing, brace, sheet };
  }
  function kitSignature(attacks, defense) {
    const raw = [
      ...attacks.map((a) => `${a.template}:${a.element}:${a.power}:${a.animationKey}`),
      `hp${defense.hp}`,
      `ar${defense.armor}`,
      defense.massClass,
      ...defense.specials.map((s) => s.id)
    ].join("|");
    let h = 2166136261;
    for (let i = 0; i < raw.length; i++) h = Math.imul(h ^ raw.charCodeAt(i), 16777619);
    return (h >>> 0).toString(16).padStart(8, "0");
  }

  // primordia-specimen-lab/combat/lab-pane.ts
  var memory = /* @__PURE__ */ new Map();
  var PAGE = 8;
  var fieldOpen = false;
  var wardOpen = false;
  var page = 0;
  var wardPage = 0;
  var elementFilter = "all";
  var motionFilter = "all";
  var borneOnly = true;
  var query = "";
  var showToken = 0;
  function sleep(ms, token) {
    return new Promise((resolve) => {
      window.setTimeout(() => resolve(token === showToken), ms);
    });
  }
  function inhabit(ph, ctx) {
    if (ph.ecology) return ph;
    const ecology = ctx.state.ecology || ctx.state.genome?.ecology;
    return ecology ? { ...ph, ecology } : ph;
  }
  function sheetStats(raw, ph) {
    if (ph.stats?.power != null && ph.stats.guard != null && ph.stats.swift != null) return ph;
    const scores = window.__lab?.scores;
    if (!scores) return ph;
    const affinity = lab()?.state?.genome && (lab()?.state?.genome).statAffinity;
    const values = scores(raw, affinity);
    if (!values?.power) return ph;
    return { ...ph, stats: values };
  }
  function fromGenerator(genome, stage, fallback, build) {
    const read = window.__lab?.read;
    const card = genome && read ? read(genome, stage) : null;
    const raw = card?.ph ?? fallback;
    if (!raw) return null;
    return sheetStats(raw, toCombatPhenotype(raw, { build }));
  }
  function currentPhenotype() {
    const ctx = lab();
    if (!ctx?.state?.ph) return null;
    const stage = ctx.state.stage || "Apex";
    const ph = fromGenerator(ctx.state.genome, stage, ctx.state.ph, ctx.state.build);
    return ph ? inhabit(ph, ctx) : null;
  }
  function lab() {
    const ctx = window.__lab?.ctx;
    return ctx ?? null;
  }
  function el(tag, props = {}, ...kids) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null) continue;
      if (k === "class") node.className = v;
      else node.setAttribute(k, v);
    }
    for (const kid of kids) node.append(kid);
    return node;
  }
  function text(s) {
    return document.createTextNode(s);
  }
  function specimenName() {
    return document.querySelector(".common")?.textContent?.trim() || "This specimen";
  }
  function remember(id, name, stage, ph, genomeId) {
    const attacks = generateAttacks(ph);
    const defense = generateDefense(ph);
    const rec = {
      id,
      name,
      stage,
      attacks,
      defense,
      companion: companionOf(id, name, stage, ph, defense, genomeId),
      genomeId
    };
    memory.set(rec.id, rec);
    return rec;
  }
  function currentRecord() {
    const ctx = lab();
    if (!ctx?.state?.ph) return null;
    const stage = ctx.state.stage || "Apex";
    const ph = fromGenerator(ctx.state.genome, stage, ctx.state.ph, ctx.state.build);
    if (!ph) return null;
    const lived = inhabit(ph, ctx);
    const id = ctx.state.genome?.id ?? "current";
    const name = specimenName();
    const rec = remember(`${id}@${stage}`, name, stage, lived, id);
    for (const age of LIFE_STAGES) {
      if (age === stage) continue;
      const agedRaw = ctx.state.genome ? fromGenerator(ctx.state.genome, age, null, ctx.state.build) : scaledPhenotype(lived, stage, age);
      if (!agedRaw) continue;
      const aged = ctx.state.genome ? inhabit(agedRaw, ctx) : agedRaw;
      remember(`${id}@${age}`, name, age, aged, id);
    }
    return rec;
  }
  function pct(n) {
    return `${Math.round(n * 100)}%`;
  }
  function defenseBlock(defense) {
    const resists = Object.entries(defense.elementalResist).sort((a, b) => b[1] - a[1]);
    const chips = resists.map(
      ([k, v]) => el(
        "span",
        { class: v < 0 ? "chip resist weak" : "chip resist" },
        `${k} ${v > 0 ? "+" : ""}${pct(v)}`
      )
    );
    const specials = defense.specials.length ? el(
      "ul",
      { class: "list" },
      ...defense.specials.map((s) => {
        const glimpse = el("button", { class: "btn small", type: "button" }, "Glimpse");
        glimpse.addEventListener("click", () => {
          const ward2 = WARD_LEXICON.find((w) => w.name === s.name);
          playFx({
            element: ward2?.element ?? "earth",
            motion: ward2?.motion ?? "aegis",
            seed: ward2?.fxSeed ?? 1,
            title: s.name,
            intensity: 0.85
          });
        });
        return el(
          "li",
          { class: "combat-ward" },
          el("div", {}, el("code", {}, s.name), text(` ${s.description}`)),
          glimpse
        );
      })
    ) : el("p", { class: "muted" }, "No special ward. The hide is what it is.");
    return el(
      "section",
      { class: "sec" },
      el("h2", {}, "Defense"),
      el(
        "dl",
        { class: "kv" },
        el("dt", {}, "Hit points"),
        el("dd", { class: "mono" }, String(defense.hp)),
        el("dt", {}, "Armor"),
        el("dd", { class: "mono" }, pct(defense.armor)),
        el("dt", {}, "Mass"),
        el("dd", {}, defense.massClass),
        el("dt", {}, "Knockback"),
        el("dd", { class: "mono" }, pct(defense.knockbackResist)),
        ...defense.sheet ? ["power", "guard", "swift", "focus", "vigor", "spirit"].flatMap((key) => [
          el("dt", {}, key),
          el("dd", { class: "mono" }, String(defense.sheet?.[key] ?? "\u2014"))
        ]) : []
      ),
      chips.length ? el("div", { class: "chips" }, ...chips) : el("p", { class: "muted" }, "No marked elemental ward."),
      specials,
      ...defense.notes.map((n) => el("p", { class: "muted" }, n))
    );
  }
  function attackBlock(attack, onPreview) {
    const preview = el("button", { class: "btn small", type: "button", "data-k": `combat-prev-${attack.id}` }, "Preview");
    preview.addEventListener("click", onPreview);
    return el(
      "article",
      { class: "combat-atk" },
      el(
        "div",
        { class: "combat-top" },
        el("h3", { class: "combat-name" }, attack.name),
        preview
      ),
      el(
        "div",
        { class: "chips" },
        el("span", { class: "chip" }, attack.type),
        el("span", { class: "chip" }, attack.element),
        el("span", { class: "chip" }, attack.fxMotion ?? attack.animationKey),
        ...attack.manner ? [el("span", { class: "chip" }, attack.manner)] : []
      ),
      el(
        "dl",
        { class: "kv combat-stats" },
        el("dt", {}, "Power"),
        el("dd", { class: "mono" }, String(attack.power)),
        el("dt", {}, "Range"),
        el("dd", { class: "mono" }, String(attack.range)),
        el("dt", {}, "Cooldown"),
        el("dd", { class: "mono" }, String(attack.cooldown))
      ),
      el("p", {}, attack.description)
    );
  }
  function duelBook() {
    const duel = window.__lab?.duel;
    return duel ?? null;
  }
  function knownBodies() {
    const ctx = lab();
    const book = duelBook();
    const cards = book?.roster?.() ?? [];
    const found = [];
    for (const card of cards) {
      if (!card?.id || !card.stage || !card.ph) continue;
      const ph = ctx ? inhabit(toCombatPhenotype(card.ph), ctx) : toCombatPhenotype(card.ph);
      found.push(remember(`${card.id}@${card.stage}`, card.name || "Unnamed", card.stage, ph, card.id));
    }
    if (found.length) return found;
    const self = currentRecord();
    return self ? [...memory.values()].filter((r) => !self.genomeId || r.genomeId === self.genomeId) : [];
  }
  function battleBlock(self) {
    const bodies = knownBodies();
    const order = LIFE_STAGES;
    bodies.sort((a, b) => {
      const ga = a.genomeId === self.genomeId ? 0 : 1;
      const gb = b.genomeId === self.genomeId ? 0 : 1;
      if (ga !== gb) return ga - gb;
      const sa = order.indexOf(a.stage);
      const sb = order.indexOf(b.stage);
      if (sa !== sb) return (sa < 0 ? 99 : sa) - (sb < 0 ? 99 : sb);
      return a.name.localeCompare(b.name);
    });
    const labelOf = (rec) => {
      const mine = rec.genomeId === self.genomeId;
      return mine ? `${rec.stage} \xB7 ${rec.name}` : `${rec.name} \xB7 ${rec.stage}`;
    };
    const fill = (select, prefer) => {
      for (const rec of bodies) {
        const opt = el("option", { value: rec.id }, labelOf(rec));
        if (rec.id === prefer) opt.selected = true;
        select.append(opt);
      }
    };
    const leftSel = el("select", { id: "combat-left", "aria-label": "First companion" });
    const rightSel = el("select", { id: "combat-foe", "aria-label": "Second companion" });
    const leftPrefer = bodies.find((r) => r.id === self.id)?.id ?? bodies[0]?.id ?? "";
    const otherGenome = bodies.find((r) => r.genomeId && r.genomeId !== self.genomeId);
    const nextAge = bodies.find((r) => r.genomeId === self.genomeId && r.stage === order[(order.indexOf(self.stage) + 1) % order.length]);
    const rightPrefer = otherGenome?.id ?? nextAge?.id ?? bodies.find((r) => r.id !== leftPrefer)?.id ?? "";
    if (!bodies.length) {
      leftSel.append(el("option", { value: "" }, "No body is ready"));
      rightSel.append(el("option", { value: "" }, "No body is ready"));
      leftSel.disabled = true;
      rightSel.disabled = true;
    } else {
      fill(leftSel, leftPrefer);
      fill(rightSel, rightPrefer);
    }
    const seed = el("input", { id: "combat-seed", type: "text", placeholder: "Known seed, or seed@Apex", "aria-label": "Known seed" });
    const bring = el("button", { class: "btn small", type: "button", "data-k": "combat-seed-bring" }, "Bring seed");
    bring.addEventListener("click", () => {
      const raw = seed.value.trim();
      const book = duelBook();
      if (!raw || !book?.claim) return;
      try {
        const card = book.claim(raw);
        lab()?.toast?.(`${card.name} can be called to the ground.`);
        seed.value = "";
        paint(hostOf(bring));
      } catch {
        lab()?.toast?.("That seed did not grow a body.");
      }
    });
    seed.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        bring.click();
      }
    });
    const go = el("button", { class: "btn primary small", type: "button", "data-k": "combat-battle" }, "Battle");
    if (bodies.length < 2) go.setAttribute("disabled", "");
    const logHost = el("div", { id: "combat-log" });
    go.addEventListener("click", () => {
      const a = memory.get(leftSel.value);
      const b = memory.get(rightSel.value);
      if (!a || !b) return;
      if (a.id === b.id) {
        lab()?.toast?.("Pick two different bodies.");
        return;
      }
      const token = ++showToken;
      const left = { id: a.id, name: a.name, attacks: a.attacks, defense: a.defense };
      const right = { id: b.id, name: b.name, attacks: b.attacks, defense: b.defense };
      const result = resolveBattle(left, right);
      go.setAttribute("disabled", "");
      void playLog(token, logHost, result, a, b, () => {
        go.removeAttribute("disabled");
      });
    });
    const hereSeed = lab()?.state.genome?.seed;
    return el(
      "section",
      { class: "sec" },
      el("h2", {}, "Battle"),
      el(
        "p",
        {},
        "Any two bodies can meet. The one on the table is here at every age. Kept companions come as adults. A seed you know can be brought, and seed@Sprout through seed@Sovereign calls that age."
      ),
      hereSeed ? el("p", { class: "mono muted" }, hereSeed) : el("p", { class: "muted" }, ""),
      el("div", { class: "combat-pair" }, leftSel, rightSel),
      el("div", { class: "row" }, seed, bring, go),
      logHost
    );
  }
  function showBlow(event, self, foe, aim2) {
    const dueling = window.__primordiaDuel;
    const ctx = lab();
    const actor = event.actorId === self.id ? self : foe;
    const attack = actor.attacks.find((a) => a.id === event.attackId);
    const intensity2 = Math.min(1.55, 0.65 + event.damage / 36);
    if (!dueling && event.actorId === self.id && attack && event.attackId !== "dot" && event.attackId !== "knit") {
      playAttack(ctx?.anim, attack.animationKey, self.defense.massClass);
    } else if (!dueling && event.actorId !== self.id && event.attackId !== "knit") {
      try {
        ctx?.anim?.act?.("shake_off");
      } catch {
      }
    }
    playFx({
      element: event.element || attack?.element || "beast",
      motion: event.fxMotion || (event.attackId === "knit" ? "knit" : event.attackId === "dot" ? "brume" : attack?.fxMotion || "burst"),
      seed: event.fxSeed || attack?.fxSeed || 3,
      mass: actor.defense.massClass,
      title: event.attackName,
      intensity: Math.min(1.7, (event.attackId === "dot" ? 0.55 : intensity2) * (dueling ? 1.25 : 1)),
      from: aim2?.from,
      toward: aim2?.to
    });
  }
  async function playLog(token, host, result, self, foe, done) {
    const stage = openBattle(self.companion, foe.companion);
    try {
      const placed = await stage.ready;
      if (token !== showToken) return;
      if (!placed) {
        host.replaceChildren(el("p", { class: "muted" }, "The two ages are not both standing in the habitat yet."));
      }
      for (let i = 0; i < result.log.length; i++) {
        if (token !== showToken) return;
        const event = result.log[i];
        const winner = result.winnerId === self.id ? self.name : result.winnerId === foe.id ? foe.name : "Neither";
        host.replaceChildren(
          el("p", { class: "muted" }, i + 1 < result.log.length ? "Both are on the field." : result.winnerId ? `${winner} stands.` : "Neither falls."),
          el(
            "ul",
            { class: "list" },
            ...result.log.slice(0, i + 1).map(
              (entry, n) => el("li", { class: n === i ? "combat-now" : "" }, entry.text)
            )
          )
        );
        const aim2 = stage.blow(event);
        showBlow(event, self, foe, aim2);
        const ok = await sleep(placed ? 1900 : 1500, token);
        if (!ok) return;
      }
      paintLog(host, result, self, foe);
      stage.finish(result.winnerId);
      done();
    } finally {
      if (token !== showToken) stage.close();
      else window.setTimeout(() => stage.close(), 1400);
    }
  }
  function previewTechnique(tech, mass) {
    performAttack(
      lab()?.anim,
      {
        animationKey: tech.animationKey,
        element: tech.element,
        fxMotion: tech.motion,
        fxSeed: tech.fxSeed,
        name: tech.name
      },
      mass,
      1
    );
  }
  function filteredTechniques(ph) {
    const q = query.trim().toLowerCase();
    return ATTACK_LEXICON.filter((tech) => {
      if (elementFilter !== "all" && tech.element !== elementFilter) return false;
      if (motionFilter !== "all" && tech.motion !== motionFilter) return false;
      if (borneOnly && (!ph || !techniqueBorne(ph, tech))) return false;
      if (!q) return true;
      return `${tech.name} ${tech.motion} ${tech.type} ${tech.noun}`.toLowerCase().includes(q);
    });
  }
  function fieldSection(ph, equipped, mass) {
    const list = filteredTechniques(ph);
    const pages = Math.max(1, Math.ceil(list.length / PAGE));
    if (page > pages - 1) page = 0;
    const slice = list.slice(page * PAGE, page * PAGE + PAGE);
    const borne = ph ? ATTACK_LEXICON.filter((tech) => techniqueBorne(ph, tech)).length : 0;
    const toggle = el("button", { class: "btn small", type: "button" }, fieldOpen ? "Close the field" : "Open the field");
    toggle.addEventListener("click", () => {
      fieldOpen = !fieldOpen;
      paint(hostOf(toggle));
    });
    const witness = el("button", { class: "btn primary small", type: "button" }, "Witness four");
    witness.addEventListener("click", () => {
      if (!ph) return;
      const token = ++showToken;
      const pool2 = ATTACK_LEXICON.filter((tech) => techniqueBorne(ph, tech) && !equipped.has(tech.id));
      const source = pool2.length >= 4 ? pool2 : ATTACK_LEXICON.filter((tech) => tech.element === (ph.element || "beast"));
      if (!source.length) return;
      const start = fieldHash(`${ph.element}:${ph.sizeM}:${ph.build ?? ""}`) % source.length;
      const chosen = [];
      for (let i = 0; chosen.length < 4 && i < source.length; i++) {
        const tech = source[(start + i * 97) % source.length];
        if (!chosen.some((c) => c.motion === tech.motion)) chosen.push(tech);
      }
      void (async () => {
        for (const tech of chosen) {
          if (token !== showToken) return;
          previewTechnique(tech, mass);
          const ok = await sleep(1500, token);
          if (!ok) return;
        }
      })();
    });
    const head = el(
      "section",
      { class: "sec" },
      el("h2", {}, "The wider field"),
      el(
        "p",
        {},
        `The field holds ${ATTACK_LEXICON.length.toLocaleString()} attack performances and ${WARD_LEXICON.length.toLocaleString()} wards. This body can bear ${borne.toLocaleString()} of the blows. A fight still carries six, so the weight stays fair.`
      ),
      el("div", { class: "row" }, toggle, witness)
    );
    if (!fieldOpen) return head;
    const elementSel = el("select", { id: "combat-element", "aria-label": "Element" });
    elementSel.append(el("option", { value: "all" }, "Every element"));
    for (const element of ELEMENTS) {
      const opt = el("option", { value: element }, element);
      if (element === elementFilter) opt.selected = true;
      elementSel.append(opt);
    }
    elementSel.addEventListener("change", () => {
      elementFilter = elementSel.value;
      page = 0;
      paint(hostOf(elementSel));
    });
    const motionSel = el("select", { id: "combat-motion", "aria-label": "Motion" });
    motionSel.append(el("option", { value: "all" }, "Every motion"));
    for (const motion of MOTIONS) {
      const opt = el("option", { value: motion }, motion);
      if (motion === motionFilter) opt.selected = true;
      motionSel.append(opt);
    }
    motionSel.addEventListener("change", () => {
      motionFilter = motionSel.value;
      page = 0;
      paint(hostOf(motionSel));
    });
    const search = el("input", {
      id: "combat-find",
      type: "search",
      placeholder: "Find a blow",
      "aria-label": "Find a blow",
      value: query
    });
    search.addEventListener("input", () => {
      query = search.value;
      page = 0;
      const caret = search.selectionStart ?? query.length;
      paint(hostOf(search));
      const again = document.getElementById("combat-find");
      again?.focus();
      again?.setSelectionRange(caret, caret);
    });
    const borneBtn = el(
      "button",
      { class: "btn small", type: "button" },
      borneOnly ? "Showing what this body can bear" : "Showing the whole field"
    );
    borneBtn.addEventListener("click", () => {
      borneOnly = !borneOnly;
      page = 0;
      paint(hostOf(borneBtn));
    });
    const prev = el("button", { class: "btn small", type: "button" }, "Previous");
    const next = el("button", { class: "btn small", type: "button" }, "Next");
    if (page <= 0) prev.setAttribute("disabled", "");
    if (page >= pages - 1) next.setAttribute("disabled", "");
    prev.addEventListener("click", () => {
      page -= 1;
      paint(hostOf(prev));
    });
    next.addEventListener("click", () => {
      page += 1;
      paint(hostOf(next));
    });
    const from = list.length === 0 ? 0 : page * PAGE + 1;
    const to = Math.min(list.length, (page + 1) * PAGE);
    const rows = slice.map((tech) => {
      const preview = el("button", { class: "btn small", type: "button" }, "Preview");
      preview.addEventListener("click", () => previewTechnique(tech, mass));
      return el(
        "article",
        { class: "combat-lex-row" },
        preview,
        el(
          "div",
          {},
          el("div", { class: "combat-lex-name" }, tech.name),
          el("p", { class: "muted combat-lex-meta" }, `${tech.type} \xB7 ${tech.element} \xB7 ${tech.motion} \xB7 weight ${tech.basePower}`)
        )
      );
    });
    head.append(
      el("div", { class: "combat-filters" }, elementSel, motionSel, search, borneBtn),
      el("div", {}, ...rows),
      el("div", { class: "row" }, prev, el("span", { class: "mono muted" }, `${from}\u2013${to} of ${list.length}`), next)
    );
    return head;
  }
  function wardSection() {
    const toggle = el("button", { class: "btn small", type: "button" }, wardOpen ? "Close the wards" : "Open the wards");
    toggle.addEventListener("click", () => {
      wardOpen = !wardOpen;
      paint(hostOf(toggle));
    });
    const section = el(
      "section",
      { class: "sec" },
      el("h2", {}, "Wards"),
      el("p", { class: "muted" }, `${WARD_LEXICON.length.toLocaleString()} ways a body can refuse a little of a blow. A specimen wears a few, not the shelf.`),
      toggle
    );
    if (!wardOpen) return section;
    const pages = Math.max(1, Math.ceil(WARD_LEXICON.length / PAGE));
    if (wardPage > pages - 1) wardPage = 0;
    const slice = WARD_LEXICON.slice(wardPage * PAGE, wardPage * PAGE + PAGE);
    const prev = el("button", { class: "btn small", type: "button" }, "Previous");
    const next = el("button", { class: "btn small", type: "button" }, "Next");
    if (wardPage <= 0) prev.setAttribute("disabled", "");
    if (wardPage >= pages - 1) next.setAttribute("disabled", "");
    prev.addEventListener("click", () => {
      wardPage -= 1;
      paint(hostOf(prev));
    });
    next.addEventListener("click", () => {
      wardPage += 1;
      paint(hostOf(next));
    });
    section.append(
      el(
        "div",
        {},
        ...slice.map((ward2) => {
          const glimpse = el("button", { class: "btn small", type: "button" }, "Glimpse");
          glimpse.addEventListener("click", () => {
            playFx({ element: ward2.element, motion: ward2.motion, seed: ward2.fxSeed, title: ward2.name, intensity: 0.85 });
          });
          return el(
            "article",
            { class: "combat-lex-row" },
            glimpse,
            el(
              "div",
              {},
              el("div", { class: "combat-lex-name" }, ward2.name),
              el("p", { class: "muted combat-lex-meta" }, ward2.description)
            )
          );
        })
      ),
      el(
        "div",
        { class: "row" },
        prev,
        el("span", { class: "mono muted" }, `${wardPage * PAGE + 1}\u2013${Math.min(WARD_LEXICON.length, (wardPage + 1) * PAGE)} of ${WARD_LEXICON.length}`),
        next
      )
    );
    return section;
  }
  function hostOf(node) {
    const pane2 = (node instanceof HTMLElement ? node : node.parentElement)?.closest("[data-pane]");
    return pane2 ?? document.body;
  }
  function paintLog(host, result, self, foe) {
    const winner = result.winnerId === self.id ? self.name : result.winnerId === foe.id ? foe.name : "Neither";
    host.replaceChildren(
      el(
        "p",
        {},
        result.winnerId ? `${winner} stands. ` : "Neither falls. ",
        el("span", { class: "mono" }, `${self.name} ${result.leftHp} \xB7 ${foe.name} ${result.rightHp}`)
      ),
      el(
        "ul",
        { class: "list" },
        ...result.log.map((e) => el("li", {}, e.text))
      )
    );
  }
  function copyRecord(rec) {
    const ctx = lab();
    const ph = ctx?.state?.ph ? toCombatPhenotype(ctx.state.ph, { build: ctx.state.build }) : null;
    const payload = {
      format: "primordia-combat",
      id: rec.id,
      name: rec.name,
      stage: rec.stage,
      genome: ctx?.state?.genome?.id ?? null,
      signature: kitSignature(rec.attacks, rec.defense),
      phenotype: ph,
      attacks: rec.attacks,
      defense: rec.defense
    };
    const raw = JSON.stringify(payload, null, 2);
    const done = (msg) => ctx?.toast?.(msg);
    navigator.clipboard?.writeText(raw).then(
      () => done("Combat record copied."),
      () => done("Could not copy the combat record.")
    );
  }
  function paint(host) {
    const rec = currentRecord();
    host.replaceChildren();
    if (!rec) {
      host.append(el("p", { class: "muted" }, "No specimen is on the stand."));
      return;
    }
    const sig = kitSignature(rec.attacks, rec.defense);
    const copy = el("button", { class: "btn small", type: "button", "data-k": "combat-copy" }, "Copy kit");
    copy.addEventListener("click", () => copyRecord(rec));
    const ctx = lab();
    const ph = currentPhenotype();
    host.append(
      el(
        "section",
        { class: "sec" },
        el("h2", {}, "Field of arms"),
        el(
          "p",
          {},
          "Six blows are carried into a fight. Mass still tells, and element still tells, and a single moment is not allowed to spend the whole fight. The same body always keeps the same six."
        ),
        el("p", { class: "mono muted" }, `Kit ${sig} \xB7 ${rec.attacks.length} carried \xB7 ${ATTACK_LEXICON.length.toLocaleString()} in the field`),
        el("div", { class: "row" }, copy)
      ),
      defenseBlock(rec.defense),
      el(
        "section",
        { class: "sec" },
        el("h2", {}, "Carried blows"),
        ...rec.attacks.map(
          (attack) => attackBlock(attack, () => {
            const played = performAttack(ctx?.anim, attack, rec.defense.massClass, 1);
            if (played.fallback) ctx?.toast?.(`No driver for ${attack.animationKey}. A generic act plays.`);
          })
        )
      ),
      fieldSection(ph, new Set(rec.attacks.map((a) => a.variantId ?? "")), rec.defense.massClass),
      wardSection(),
      battleBlock(rec)
    );
  }
  function installStyle() {
    let style = document.getElementById("primordia-combat-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "primordia-combat-style";
      document.head.append(style);
    }
    style.textContent = `
    .combat-atk { display: grid; gap: 6px; padding: 12px 0; border-top: 1px solid var(--line); }
    .combat-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .combat-name, .combat-lex-name { margin: 0; font-family: var(--f-display); font-weight: 700; font-size: var(--step-1); }
    .combat-stats { margin-top: 2px; }
    .combat-lex-row { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px; align-items: center; padding: 10px 0; border-top: 1px solid var(--line); }
    .combat-lex-meta { margin: 2px 0 0; }
    .combat-ward { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; }
    .combat-now { background: color-mix(in srgb, var(--accent, var(--lichen, #c2d27d)) 18%, transparent); }
    .combat-filters { display: grid; gap: 8px; margin: 8px 0; }
    .combat-filters select, .combat-filters input { min-height: 36px; width: 100%; box-sizing: border-box; border-radius: 10px; border: 1px solid var(--line); background: var(--panel-2); color: var(--text); padding: 6px 10px; font: inherit; }
    .chip.resist { font-family: var(--f-mono); font-size: 0.68rem; letter-spacing: 0.04em; text-transform: uppercase; padding: 2px 7px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); }
    .chip.resist.weak { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 55%, var(--line)); }
    #combat-foe, #combat-left, #combat-seed { min-height: 36px; border-radius: 10px; border: 1px solid var(--line); background: var(--panel-2); color: var(--text); padding: 6px 10px; font: inherit; }
    .combat-pair { display: grid; gap: 8px; }
    .combat-pair select, #combat-seed { width: 100%; box-sizing: border-box; }
    .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    #combat-seed { flex: 1 1 160px; }
  `;
  }
  function pane(host) {
    installStyle();
    paint(host);
  }
  function boot() {
    const ctx = lab();
    if (!ctx) {
      window.setTimeout(boot, 300);
      return;
    }
    window.__primordiaCombat = { pane };
    ctx.on?.("shown", () => {
      currentRecord();
    });
    if (ctx.state?.ph) currentRecord();
  }
  boot();
  window.__primordiaCombat = {
    adopt(ph) {
      const mapped = toCombatPhenotype(ph);
      const attacks = generateAttacks(mapped);
      const defense = generateDefense(mapped);
      return {
        element: mapped.element,
        element2: mapped.element2 ?? null,
        covering: mapped.covering.type,
        plan: mapped.plan ?? "",
        loco: mapped.loco ?? "",
        volant: Boolean(mapped.volant),
        sizeM: mapped.sizeM,
        stats: mapped.stats ?? null,
        units: mapped.units.map((u) => ({ unit: u.unit, count: u.count })),
        diet: mapped.diet ?? null,
        attacks: attacks.map((a) => a.template),
        hp: defense.hp,
        edge: defense.edge ?? null
      };
    }
  };
})();
