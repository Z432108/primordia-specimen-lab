import { GUARD_ACTS, playAttack, playOwnedAct } from "./animate.ts";
import type { CombatPhenotype, DefenseProfile, MassClass } from "./types.ts";

export const LIFE_STAGES = ["Sprout", "Keen", "Adept", "Apex", "Steward", "Artisan", "Exemplar", "Sovereign"] as const;

/** Relative bulk of each age. Apex is the adult the phenotype was written against. The last four are the ascent. */
const STAGE_BULK = [0.42, 0.68, 0.88, 1, 1.12, 1.26, 1.4, 1.58];

export type Gait = "rooted" | "ooze" | "radial" | "slither" | "crawl" | "scuttle" | "gallop" | "stride" | "swim" | "fly" | "hover";

export interface Companion {
  id: string;
  name: string;
  stage: string;
  element: string;
  sizeM: number;
  maxHp: number;
  hp: number;
  horns: boolean;
  wings: boolean;
  tail: boolean;
  legs: number;
  claws: boolean;
  fins: boolean;
  tentacles: boolean;
  shell: boolean;
  covering: string;
  loco: string;
  ecology: string;
  armor: number;
  plan: string;
  organ: string;
  volant: boolean;
  spines: boolean;
  mandibles: boolean;
  gait: Gait;
  /** Lab genome id, when this body is a real specimen and not only an age of the one on the table. */
  genomeId?: string;
}

export function stageBulk(stage: string): number {
  const i = LIFE_STAGES.indexOf(stage as (typeof LIFE_STAGES)[number]);
  return STAGE_BULK[i] ?? 1;
}

const STAGE_STAT: Record<string, number> = {
  Sprout: 0.55,
  Keen: 0.75,
  Adept: 0.92,
  Apex: 1,
  Steward: 1,
  Artisan: 1,
  Exemplar: 1,
  Sovereign: 1,
};

export function scaledPhenotype(ph: CombatPhenotype, fromStage: string, toStage: string): CombatPhenotype {
  const from = stageBulk(fromStage || "Apex");
  const to = stageBulk(toStage);
  const next: CombatPhenotype = { ...ph, sizeM: Math.max(0.12, ph.sizeM * (to / from)) };
  const sheet = ph.stats && Object.values(ph.stats).some((v) => v > 3);
  if (sheet && ph.stats) {
    const ratio = (STAGE_STAT[toStage] ?? 1) / (STAGE_STAT[fromStage] ?? 1);
    const stats: Record<string, number> = {};
    for (const [key, value] of Object.entries(ph.stats)) {
      stats[key] = Math.max(1, Math.min(100, Math.round(value * ratio)));
    }
    next.stats = stats;
  }
  return next;
}

export function companionOf(
  id: string,
  name: string,
  stage: string,
  ph: CombatPhenotype,
  defense: DefenseProfile,
  genomeId?: string,
): Companion {
  const units = new Set(ph.units.map((u) => u.unit));
  const legUnit = ph.units.find((u) => u.unit === "leg");
  let legs = legUnit?.count ?? 0;
  if (!legs && (ph.plan === "biped" || ph.loco === "BipedWalk")) legs = 2;
  if (!legs && (ph.plan === "quadruped" || ph.plan === "centauroid" || ph.loco === "QuadGait")) legs = 4;
  if (!legs && (ph.plan === "hexapod" || ph.loco === "MultiLegRipple")) legs = 6;
  if (!legs && ph.plan === "octopod") legs = 8;
  const covering = ph.covering?.type || "skin";
  const companion: Companion = {
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
    genomeId,
  };
  companion.gait = gaitOf(companion);
  return companion;
}

export interface BlowView {
  actorId: string;
  attackId: string;
  attackName: string;
  hpAfter: number;
  element?: string;
  fxMotion?: string;
  animationKey?: string;
  damage?: number;
  aside?: string;
  hits?: number;
}

export interface Aim {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export interface BattleStage {
  ready: Promise<boolean>;
  blow(event: BlowView): Aim;
  finish(winnerId: string | null): void;
  close(): void;
}

export interface Cover {
  x: number;
  y: number;
  r: number;
  kind: "stone" | "tree" | "pool" | "vent" | "dune" | "ice";
}

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

function coversFor(ecology: string, elements: string): Cover[] {
  const e = ecology.toLowerCase();
  if (/deep_ocean|reef|swamp|aquatic/.test(e)) {
    return [
      { x: 0.5, y: 0.58, r: 0.14, kind: "pool" },
      { x: 0.22, y: 0.42, r: 0.06, kind: "stone" },
      { x: 0.78, y: 0.4, r: 0.06, kind: "stone" },
    ];
  }
  if (/tundra|alpine/.test(e)) {
    return [
      { x: 0.3, y: 0.48, r: 0.07, kind: "ice" },
      { x: 0.62, y: 0.4, r: 0.06, kind: "stone" },
      { x: 0.74, y: 0.66, r: 0.08, kind: "ice" },
    ];
  }
  if (/grassland/.test(e)) {
    return [
      { x: 0.34, y: 0.55, r: 0.09, kind: "dune" },
      { x: 0.68, y: 0.42, r: 0.05, kind: "stone" },
      { x: 0.8, y: 0.7, r: 0.07, kind: "dune" },
    ];
  }
  if (/forest|jungle/.test(e)) {
    return [
      { x: 0.32, y: 0.36, r: 0.05, kind: "tree" },
      { x: 0.68, y: 0.34, r: 0.06, kind: "tree" },
      { x: 0.5, y: 0.7, r: 0.05, kind: "stone" },
    ];
  }
  if (/desert|dune|waste|volcan|ash/.test(e)) {
    return [
      { x: 0.4, y: 0.5, r: 0.1, kind: /volcan|ash/.test(e) ? "vent" : "dune" },
      { x: 0.72, y: 0.62, r: 0.08, kind: "dune" },
      { x: 0.18, y: 0.4, r: 0.045, kind: "stone" },
    ];
  }
  if (/cave|under/.test(e)) {
    return [
      { x: 0.28, y: 0.46, r: 0.07, kind: "stone" },
      { x: 0.55, y: 0.58, r: 0.08, kind: "stone" },
      { x: 0.78, y: 0.42, r: 0.06, kind: "stone" },
    ];
  }
  if (/celestial|void/.test(e)) {
    return [
      { x: 0.3, y: 0.46, r: 0.05, kind: "vent" },
      { x: 0.62, y: 0.4, r: 0.06, kind: "stone" },
      { x: 0.74, y: 0.68, r: 0.05, kind: "vent" },
    ];
  }
  const out: Cover[] = [];
  const el = elements.toLowerCase();
  if (/water|ice/.test(el)) out.push({ x: 0.5, y: 0.58, r: 0.12, kind: /ice/.test(el) && !/water/.test(el) ? "ice" : "pool" });
  if (/plant|beast/.test(el)) out.push({ x: 0.28, y: 0.4, r: 0.05, kind: "tree" });
  if (/earth|metal/.test(el)) out.push({ x: 0.7, y: 0.5, r: 0.06, kind: "stone" });
  if (/fire|plasma|void|light|electric/.test(el)) out.push({ x: 0.62, y: 0.42, r: 0.05, kind: "vent" });
  if (/air/.test(el)) out.push({ x: 0.4, y: 0.7, r: 0.08, kind: "dune" });
  const spare: Cover["kind"][] = ["stone", "dune", "tree"];
  let n = 0;
  while (out.length < 3) out.push({ x: 0.22 + out.length * 0.24, y: 0.5, r: 0.05, kind: spare[n++ % spare.length]! });
  return out.slice(0, 4);
}

export function gaitOf(c: Companion): Gait {
  const plan = c.plan;
  const loco = c.loco;
  if (loco === "Sessile" || plan === "sessile_mass" || plan === "sessile_radial") return "rooted";
  if (loco === "Swim" || plan === "swimmer" || (plan === "aquatic_stand" && c.fins)) return "swim";
  if (plan === "aquatic_stand") return "stride";
  if (loco === "Hover" || plan === "floater" || c.organ === "levitator" || c.organ === "sails") return c.wings ? "fly" : "hover";
  if (c.volant && c.wings) return "fly";
  if (c.volant && c.legs === 0) return "hover";
  if (c.wings && c.legs === 0) return "fly";
  if (loco === "Slither" || plan === "serpentine" || plan === "segmented_serpent") return "slither";
  if (plan === "radial") return "radial";
  if (plan === "blob" || plan === "amorphous" || (c.covering === "slime" && c.legs === 0 && !c.fins)) return "ooze";
  if (plan === "worm" || loco === "Crawl") return "crawl";
  if (loco === "MultiLegRipple" || plan === "hexapod" || plan === "octopod" || c.legs >= 6) return "scuttle";
  if (loco === "QuadGait" || plan === "quadruped" || plan === "centauroid" || c.legs === 4) return "gallop";
  if (loco === "BipedWalk" || plan === "biped" || c.legs === 2) return "stride";
  if (c.fins) return "swim";
  if (c.wings) return "fly";
  if (c.legs === 0) return c.covering === "slime" ? "ooze" : "crawl";
  return "stride";
}

function nearest(covers: Cover[], x: number, y: number): Cover {
  let best = covers[0]!;
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

function beside(cover: Cover, fromX: number): { x: number; y: number } {
  const side = fromX < cover.x ? -1 : 1;
  return { x: clamp(cover.x + side * (cover.r + 0.09), 0.08, 0.92), y: clamp(cover.y + 0.04, 0.34, 0.86) };
}

function partWord(c: Companion, key: string): string {
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

function placeWord(kind: Cover["kind"]): string {
  if (kind === "pool") return "the water";
  if (kind === "tree") return "the trunk";
  if (kind === "vent") return "the vent";
  if (kind === "dune") return "the dune";
  if (kind === "ice") return "the ice";
  return "the stone";
}

function ranged(key: string): boolean {
  return /breath|shard|spine|spike|burst|cone|stream|organ|relic|dual|volley|barrage/.test(key);
}

export interface Line {
  ax: number;
  ay: number;
  az: number;
  dx: number;
  dy: number;
  dz: number;
  note: string;
}

export function chooseLine(
  a: Companion,
  d: Companion,
  attackId: string,
  key: string,
  covers: Cover[],
  ax0: number,
  ay0: number,
  dx0: number,
  dy0: number,
): Line {
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
    const pool = covers.find((c) => c.kind === "pool" || c.kind === "ice");
    if (pool) {
      const side = ax0 < pool.x ? -1 : 1;
      ax = pool.x + side * (pool.r + 0.02);
      ay = pool.y;
      az = 0.02;
      verb = `strikes out of ${placeWord(pool.kind)} with ${part}`;
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
  if (canBurrow && (/dig|burrow/.test(key) || ((a.element === "earth" && /slam|charge/.test(key) || (a.covering === "bark" && gait === "crawl")) && !ranged(key)))) {
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

interface Fig {
  stage?: string;
  duelGuest?: boolean;
  ph?: { sizeM?: number };
  build?: { min?: number[]; max?: number[] };
  view?: {
    root?: {
      position: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void };
      rotation: { y: number };
      visible: boolean;
      parent?: unknown;
    };
  };
  anim?: {
    act?: (id: string) => boolean;
    setActs?: (o: { rate: number }) => void;
    flare?: (k: number) => void;
    acts?: { rate: number; play?: (id: string, held?: boolean) => boolean; release?: () => void };
    actsAvailable?: () => string[];
    setMotion?: (id: string) => void;
    setSpeed?: (mps: number) => void;
    setStepDir?: (x: number, z: number) => void;
    setTurn?: (rate: number) => void;
    lookAt?: (v: { x: number; y: number; z: number; clone: () => { x: number; y: number; z: number } } | null) => void;
    setAttention?: (v: { x: number; y: number; z: number; clone: () => { x: number; y: number; z: number } } | null) => void;
    setWind?: (dir: { x: number; y?: number; z: number }, strength: number, underwater?: boolean) => void;
    takeoff?: () => number;
  };
}

interface Slot {
  fig: Fig;
  root: NonNullable<NonNullable<Fig["view"]>["root"]>;
  anim: Fig["anim"];
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
  foot: number;
  motion: string;
  gait: Gait;
  lunge: number;
  rush: number;
  pose: number;
  /** Closest the two centers may come while this blow is landing. 0 means the resting hulls. */
  press: number;
}

interface DuelApi {
  grow: (stage: string, genomeId?: string) => Promise<Fig | null>;
  drop: (fig: Fig | null) => void;
  landmarks: () => { x: number; z: number; r: number }[];
  stone: (x: number, z: number, r: number) => { remove?: () => void } | null;
  unstone: (mesh: { remove?: () => void } | null) => void;
  flash: (x: number, y: number, z: number, color: number, power: number) => void;
  bolt: (ax: number, ay: number, az: number, bx: number, by: number, bz: number, color: number) => void;
  frame: (a: Fig, b: Fig) => void;
  hold: (on: boolean) => void;
  ground: (x: number, y: number) => { x: number; z: number } | null;
}

interface LabCtx {
  state?: { present?: string; stage?: string; genome?: { id?: string } };
  figs?: Fig[];
  busy?: boolean;
  setPresent?: (id: string) => void;
  setStage?: (id: string) => Promise<unknown> | unknown;
}

const ELEMENT_COLOR: Record<string, number> = {
  fire: 0xff7a24,
  water: 0x389cd2,
  ice: 0xb0e2f4,
  electric: 0x6edcff,
  plasma: 0xff6ed2,
  earth: 0x8a5c30,
  plant: 0x4ea834,
  air: 0xd0e4ee,
  metal: 0xbac2cc,
  light: 0xffd06e,
  void: 0x6e28aa,
  beast: 0xb05c3e,
};

function duelApi(): DuelApi | null {
  return (window as unknown as { __lab?: { duel?: DuelApi } }).__lab?.duel ?? null;
}

function labCtx(): LabCtx | null {
  return (window as unknown as { __lab?: { ctx?: LabCtx } }).__lab?.ctx ?? null;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function reachOf(fig: Fig | undefined): number {
  const b = fig?.build;
  if (b?.min && b?.max) {
    const wide = Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]);
    return Math.max(0.08, wide * 0.46);
  }
  return Math.max(0.16, (fig?.ph?.sizeM ?? 0.8) * 0.32);
}

/** Half-extents of the grown mesh. `along` is the face (+Z), `across` is the shoulder. */
export interface Hull {
  along: number;
  across: number;
  tall: number;
}

export function hullOf(min?: number[], max?: number[], sizeM = 0.8): Hull {
  if (min && max && min.length >= 3 && max.length >= 3) {
    return {
      across: Math.max(0.05, (max[0] - min[0]) * 0.5),
      tall: Math.max(0.05, max[1] - min[1]),
      along: Math.max(0.05, (max[2] - min[2]) * 0.5),
    };
  }
  const s = Math.max(0.12, sizeM);
  return { across: s * 0.18, tall: s * 0.55, along: s * 0.28 };
}

/** How far the hull reaches in a world direction. An ellipse, not a square box. */
export function supportRadius(hull: Hull, yaw: number, dirX: number, dirZ: number): number {
  const len = Math.hypot(dirX, dirZ);
  if (len < 1e-6) return Math.max(hull.along, hull.across);
  const dx = dirX / len;
  const dz = dirZ / len;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  return Math.sqrt((hull.across * lx) * (hull.across * lx) + (hull.along * lz) * (hull.along * lz));
}

export function touchDistance(
  a: Hull,
  aYaw: number,
  ax: number,
  az: number,
  b: Hull,
  bYaw: number,
  bx: number,
  bz: number,
  weapon = 0,
): number {
  const dx = bx - ax;
  const dz = bz - az;
  return supportRadius(a, aYaw, dx, dz) + supportRadius(b, bYaw, -dx, -dz) + Math.max(0, weapon);
}

function bodyLen(fig: Fig): number {
  const b = fig.build;
  if (b?.min && b?.max) {
    return Math.max(0.12, b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]);
  }
  return Math.max(0.12, fig.ph?.sizeM ?? 0.6);
}

function footOf(fig: Fig): number {
  const minY = fig.build?.min?.[1] ?? 0;
  return minY < 0 ? -minY : 0;
}

function planted(fig: Fig | undefined): boolean {
  const root = fig?.view?.root;
  return Boolean(root && root.parent);
}

async function ensureHero(stage: string, dead: () => boolean): Promise<Fig | null> {
  const ctx = labCtx();
  if (!ctx) return null;
  if (ctx.state?.present && ctx.state.present !== "natural") {
    try {
      ctx.setPresent?.("natural");
    } catch {
      /* the viewer refused */
    }
    const until = performance.now() + 20000;
    while (!dead() && performance.now() < until) {
      const figs = ctx.figs ?? [];
      if (ctx.state?.present === "natural" && figs.length === 1 && planted(figs[0])) break;
      await wait(160);
    }
  }
  if (ctx.state?.stage && ctx.state.stage !== stage) {
    try {
      await ctx.setStage?.(stage);
    } catch {
      /* this age would not grow */
    }
  }
  const until = performance.now() + 20000;
  while (!dead() && performance.now() < until) {
    if (ctx.busy) {
      await wait(160);
      continue;
    }
    const hero = (ctx.figs ?? []).find((f) => f.stage === stage && !f.duelGuest && planted(f));
    if (ctx.state?.present === "natural" && hero) return hero;
    await wait(160);
  }
  return (ctx.figs ?? []).find((f) => !f.duelGuest && planted(f)) ?? null;
}

function propKind(ecology: string): Cover["kind"] {
  const e = ecology.toLowerCase();
  if (/deep_ocean|reef|swamp/.test(e)) return "pool";
  if (/tundra|alpine/.test(e)) return "ice";
  if (/desert|volcan/.test(e)) return "dune";
  if (/forest|grass|jungle/.test(e)) return "tree";
  if (/cave/.test(e)) return "stone";
  return "stone";
}

function habitatCovers(api: DuelApi, span: number, ecology: string, elements: string): Cover[] {
  const kind = propKind(ecology);
  const covers: Cover[] = [];
  for (const mark of api.landmarks()) {
    const nx = 0.5 + mark.x / span;
    const ny = 0.6 + mark.z / span;
    if (nx < 0.02 || nx > 0.98 || ny < 0.22 || ny > 0.96) continue;
    covers.push({
      x: clamp(nx, 0.08, 0.92),
      y: clamp(ny, 0.3, 0.9),
      r: clamp(mark.r / span, 0.045, 0.16),
      kind,
    });
    if (covers.length >= 5) break;
  }
  return covers.length >= 2 ? covers : coversFor(ecology, elements);
}

function desiredMotion(gait: Gait, moving: boolean, airborne: boolean): string {
  if (gait === "swim") return moving || airborne ? "swim" : "idle";
  if (gait === "fly" || gait === "hover" || airborne) return "fly";
  if (gait === "rooted" || !moving) return "idle";
  return "walk";
}

function paceOf(gait: Gait, length: number, rushing: boolean): number {
  if (gait === "rooted") return 0;
  const body = Math.max(0.18, length);
  let lengths = rushing ? 2.7 : 1.35;
  if (gait === "ooze") lengths *= 0.42;
  else if (gait === "slither" || gait === "crawl" || gait === "radial") lengths *= 0.75;
  else if (gait === "fly" || gait === "hover" || gait === "gallop") lengths *= 1.22;
  else if (gait === "swim") lengths *= 0.92;
  return body * lengths;
}

function wrapAngle(a: number): number {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}

function gaze(x: number, y: number, z: number): { x: number; y: number; z: number; clone: () => { x: number; y: number; z: number } } {
  return {
    x,
    y,
    z,
    clone() {
      return gaze(this.x, this.y, this.z);
    },
  };
}

interface Cam {
  position: { set: (x: number, y: number, z: number) => void };
  fov?: number;
  aspect?: number;
  updateProjectionMatrix?: () => void;
  updateMatrixWorld?: (force?: boolean) => void;
  clearViewOffset?: () => void;
  matrixWorldInverse?: { elements: ArrayLike<number> };
  projectionMatrix?: { elements: ArrayLike<number> };
}

interface Controls {
  target: { set: (x: number, y: number, z: number) => void };
  autoRotate?: boolean;
  minDistance?: number;
  maxDistance?: number;
}

function ensureDuelStyle(): void {
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

/** Stand the two real ages in the habitat and move those meshes. */
export function openBattle(left: Companion, right: Companion): BattleStage {
  const app = document.getElementById("app") ?? document.body;
  const stage = (window as unknown as {
    __lab?: {
      stage?: {
        camera?: Cam;
        activeCamera?: Cam;
        controls?: Controls;
        setAutoRotate?: (on: boolean) => void;
        setInsets?: (top: number, bottom: number, left?: number, right?: number) => void;
        insets?: { top: number; bottom: number; left: number; right: number };
      };
    };
  }).__lab?.stage;
  const layout = (window as unknown as {
    __lab?: { layout?: { immersive?: boolean; setImmersive?: (on: boolean) => void } };
  }).__lab?.layout;
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
      /* the notes stay */
    }
  }
  try {
    stage?.setAutoRotate?.(false);
  } catch {
    /* the turntable stays */
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
  const tint = (element: string) => `#${(ELEMENT_COLOR[element] ?? 0xb05c3e).toString(16).padStart(6, "0")}`;
  const rgba = (element: string, a: number) => {
    const n = ELEMENT_COLOR[element] ?? 0xb05c3e;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
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
  const paint = (text: string) => {
    nameL.textContent = left.name;
    nameR.textContent = right.name;
    metaL.textContent = `${left.stage} · ${left.element}`;
    metaR.textContent = `${right.stage} · ${right.element}`;
    barL.style.transform = `scaleX(${Math.max(0, Math.min(1, hpL / left.maxHp))})`;
    barR.style.transform = `scaleX(${Math.max(0, Math.min(1, hpR / right.maxHp))})`;
    line.textContent = text;
  };
  paint("Both are taking their places.");

  let span = 3.2;
  let covers: Cover[] = coversFor(`${left.ecology} ${right.ecology}`, `${left.element} ${right.element}`);
  const slots: Slot[] = [];
  const stones: Array<{ remove?: () => void; position?: { x: number; y: number; z: number } } | null> = [];
  const guests: Fig[] = [];
  let heroFig: Fig | null = null;
  let heroHidden = false;
  let heroHome: { x: number; y: number; z: number; ry: number } | null = null;
  let running = false;
  let closed = false;
  let raf = 0;
  let orbitSideX = 0;
  let orbitSideZ = 1;
  let lastTick = performance.now();
  let shake = 0;
  let drama = 0;
  let punch = 0;
  let homeFov: number | undefined;
  let userUntil = 0;
  let pointerDown = false;
  let settle: (ok: boolean) => void = () => {};
  const ready = new Promise<boolean>((resolve) => {
    settle = resolve;
  });
  const aimCamera = () => {
    const cam = stage?.activeCamera || stage?.camera;
    const controls = stage?.controls;
    if (!cam || !controls || slots.length < 2) return;
    if (pointerDown || performance.now() < userUntil) return;
    controls.minDistance = 0.02;
    controls.maxDistance = 200;
    const a = slots[0]!;
    const b = slots[1]!;
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
    const canvas = document.querySelector("canvas");
    const aspect = canvas && canvas.clientHeight > 40 ? canvas.clientWidth / canvas.clientHeight : cam.aspect || 1.5;
    const fov = cam.fov && cam.fov > 8 ? cam.fov : 32;
    const halfW = Math.tan((fov * Math.PI) / 360) * Math.max(0.42, aspect);
    const halfSpan = Math.max(0.2, sep * 0.5 + bulk * 0.42);
    let dist = halfSpan / halfW / (aspect < 0.92 ? 0.9 : 0.78);
    dist = Math.max(dist, bulk * 1.7, 0.85);
    if (striking) dist *= 0.88;
    const lift = dist * (aspect < 0.92 ? 0.22 : striking ? 0.2 : 0.26) + (striking ? drama : 0);
    const jx = (Math.random() - 0.5) * shake;
    const jz = (Math.random() - 0.5) * shake;
    try {
      cam.clearViewOffset?.();
    } catch {
      /* this camera has no offset */
    }
    cam.position.set(mx + orbitSideX * dist + jx, my + lift, mz + orbitSideZ * dist + jz);
    controls.target.set(mx, my, mz);
    shake *= 0.86;
  };

  const hull = (s: Slot) => hullOf(s.fig.build?.min, s.fig.build?.max, s.fig.ph?.sizeM ?? 0.8);

  const centers = (a: Slot, b: Slot, weapon: number) =>
    touchDistance(hull(a), a.root.rotation.y, a.x, a.z, hull(b), b.root.rotation.y, b.x, b.z, weapon);

  interface Strike {
    ranged: boolean;
    gap: number;
    weapon: number;
    lift: number;
    flank: number;
    lunge: number;
    rear: boolean;
  }

  const strikeOf = (motion: string, key: string): Strike => {
    const m = motion || "";
    const tail = /tail|cyclone/.test(`${m} ${key}`);
    const far = /stream|cone|spiral|brume|volley|rain|sigil/.test(m) || /breath_|shard|volley|barrage|organ|dual/.test(key);
    const base = (extra: Partial<Strike>): Strike => ({
      ranged: false, gap: 0.96, weapon: 0.22, lift: 0, flank: 0, lunge: 0.2, rear: tail, ...extra,
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

  const drive = (s: Slot, other: Slot | undefined, dt: number) => {
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
      vx = (toX / dist) * step;
      vz = (toZ / dist) * step;
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
          /* this rig does not turn */
        }
      }
    }
    const ry = s.root.rotation.y;
    s.root.position.set(s.x + Math.sin(ry) * s.lunge, s.y, s.z + Math.cos(ry) * s.lunge);
    const moving = step > 0.0005 || Math.abs(s.lunge) > 0.03;
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
      /* this rig ignored the gait */
    }
  };

  interface MarkMesh {
    position: { x: number; y: number; z: number };
    scale: { set: (x: number, y: number, z: number) => void };
    material?: {
      color?: { set: (n: number) => void };
      emissive?: { set: (n: number) => void };
      emissiveIntensity?: number;
      roughness?: number;
      metalness?: number;
    };
    castShadow?: boolean;
    receiveShadow?: boolean;
  }
  const marks: Array<{ mesh: MarkMesh; glow: number } | null> = [null, null];
  const layMark = (s: Slot, element: string) => {
    const mesh = duelApi()?.stone(s.x, s.z, 0.42) as MarkMesh | null;
    if (!mesh?.scale?.set) return null;
    const color = ELEMENT_COLOR[element] ?? ELEMENT_COLOR.beast!;
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
    if (!running) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastTick) / 1000);
    lastTick = now;
    const live = slots.filter((s) => s.root.parent);
    if (live.length < slots.length) {
      paint("The ground shifted under them.");
      running = false;
      return;
    }
    for (let i = 0; i < slots.length; i++) drive(slots[i]!, slots[1 - i], dt);
    if (slots.length >= 2) {
      const a = slots[0]!;
      const b = slots[1]!;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      const bodies = centers(a, b, 0);
      const allowed = a.press > 0 || b.press > 0 ? Math.min(a.press || bodies, b.press || bodies) : bodies * 0.92;
      if (dist < allowed) {
        const ux = dx / dist;
        const uz = dz / dist;
        const need = allowed - dist;
        const shove = (s: Slot, sign: number, amount: number) => {
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
    raf = requestAnimationFrame(tick);
  };

  const stand = (fig: Fig, side: number, gait: Gait) => {
    const root = fig.view?.root;
    if (!root) return;
    const x = side * span * 0.5;
    const y = footOf(fig);
    const slot: Slot = {
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
      press: 0,
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
      paint("The habitat has no body to put on the ground.");
      settle(false);
      return;
    }
    if (ctx.state?.present && ctx.state.present !== "natural") {
      try {
        ctx.setPresent?.("natural");
      } catch {
        /* the viewer refused */
      }
    }
    const until = performance.now() + 20000;
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
    const isLive = (c: Companion) => Boolean(liveId && c.genomeId === liveId && c.stage === liveStage);
    heroFig = (ctx.figs ?? []).find((f) => !f.duelGuest && planted(f) && (!liveStage || f.stage === liveStage))
      ?? (ctx.figs ?? []).find((f) => !f.duelGuest && planted(f))
      ?? null;
    const take = async (c: Companion): Promise<Fig | null> => {
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
      paint("One of them did not take a body.");
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
    paint(`${left.name} and ${right.name}. Drag to walk around them.`);
    running = true;
    raf = requestAnimationFrame(tick);
    settle(true);
  })();

  const onPointerDown = (ev: PointerEvent) => {
    const el = ev.target instanceof Element ? ev.target : null;
    if (el?.closest("canvas")) {
      pointerDown = true;
      downX = ev.clientX;
      downY = ev.clientY;
    }
  };
  const onPointerUp = (ev: PointerEvent) => {
    const dragged = Math.hypot(ev.clientX - downX, ev.clientY - downY) > 10;
    pointerDown = false;
    if (dragged) {
      userUntil = performance.now() + 2200;
      return;
    }
    if (!running || ev.button !== 0) return;
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
        kind: "stone",
      },
    ].slice(-6);
    paint("A stone is in the way.");
  };
  let downX = 0;
  let downY = 0;
  app.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);

  const project = (x: number, y: number, z: number): { x: number; y: number } | null => {
    const cam = stage?.activeCamera || stage?.camera;
    const e = cam?.matrixWorldInverse?.elements;
    const p = cam?.projectionMatrix?.elements;
    if (!cam || !e || !p || e.length < 16 || p.length < 16) return null;
    try {
      cam.updateMatrixWorld?.(true);
    } catch {
      /* the camera matrix stays as the last frame left it */
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
      y: (-y2 / w2 * 0.5 + 0.5) * gr.height + gr.top - fr.top,
    };
  };

  const screenAim = (actorIsLeft: boolean, fromWorld?: { x: number; y: number; z: number } | null, toWorld?: { x: number; y: number; z: number } | null): Aim => {
    const r = app.getBoundingClientRect();
    const fallback: Aim = actorIsLeft
      ? { from: { x: r.width * 0.32, y: r.height * 0.55 }, to: { x: r.width * 0.68, y: r.height * 0.55 } }
      : { from: { x: r.width * 0.68, y: r.height * 0.55 }, to: { x: r.width * 0.32, y: r.height * 0.55 } };
    if (fromWorld && toWorld) {
      const pa = project(fromWorld.x, fromWorld.y, fromWorld.z);
      const pb = project(toWorld.x, toWorld.y, toWorld.z);
      if (pa && pb) return { from: pa, to: pb };
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

  const put = (slot: Slot | undefined, nx: number, ny: number, nz: number) => {
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
      let hitFrom: { x: number; y: number; z: number } | null = null;
      let hitTo: { x: number; y: number; z: number } | null = null;
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
      const quiet = event.attackId === "knit" || event.attackId === "dot" || event.attackId === "close" || event.attackId === "guard" || event.damage === 0;
      if (event.attackId === "close") {
        if (actorIsLeft && slots[0]) slots[0].tx += 0.7;
        if (!actorIsLeft && slots[1]) slots[1].tx -= 0.7;
      }
      if (actorSlot && defendSlot && !quiet) {
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
        const px = -uz;
        const pz = ux;
        if (actorSlot.gait === "rooted") {
          actorSlot.tx = actorSlot.x;
          actorSlot.tz = actorSlot.z;
          if (!shape.ranged && defendSlot.gait !== "rooted") {
            defendSlot.tx = actorSlot.x + ux * gap;
            defendSlot.tz = actorSlot.z + uz * gap;
          }
        } else {
          actorSlot.tx = defendSlot.x - ux * gap + px * flank;
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
        shake = Math.min(0.22, 0.05 + (Number(event.damage) || 8) / 220);
      }
      if (event.attackId === "knit" || event.attackId === "dot") {
        if (actorIsLeft) hpL = event.hpAfter;
        else hpR = event.hpAfter;
      } else if (actorIsLeft) hpR = event.hpAfter;
      else hpL = event.hpAfter;
      const mass: MassClass = actor.sizeM > 2.2 ? "heavy" : actor.sizeM < 0.9 ? "light" : "medium";
      if (actorSlot?.anim && event.animationKey && event.attackId !== "knit" && event.attackId !== "dot") {
        playAttack(actorSlot.anim, event.animationKey, mass, event.fxMotion);
      }
      if (defendSlot?.anim && event.attackId !== "knit") {
        const massD: MassClass = defender.sizeM > 2.2 ? "heavy" : defender.sizeM < 0.9 ? "light" : "medium";
        playOwnedAct(defendSlot.anim, GUARD_ACTS, massD);
      }
      const api = duelApi();
      const color = ELEMENT_COLOR[event.element || actor.element] ?? ELEMENT_COLOR.beast!;
      const power = Math.min(1.6, 0.45 + (Number.isFinite(event.damage) ? event.damage! : 12) / 40);
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
          z: actorSlot.z + fz * reach * dir + sz * shape.flank * attackerHull.across,
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
          z: defendSlot.z - uz * skin,
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
              /* the light has already gone */
            }
          }, n * 150);
        }
        if (shape.ranged || event.attackId === "dot") api.bolt(from.x, from.y, from.z, to.x, to.y, to.z, color);
        const ring = Math.max(0.16, hull(defendSlot).across * (shape.lift > 0.2 ? 1.45 : 1.05));
        const sparks = shape.ranged ? 3 : 5;
        for (let i = 0; i < sparks; i++) {
          const ang = (i / sparks) * Math.PI * 2;
          const x = to.x + Math.cos(ang) * ring;
          const z = to.z + Math.sin(ang) * ring;
          const y = shape.lift > 0.2 ? to.y * 0.45 + defendSlot.y * 0.55 : to.y;
          window.setTimeout(() => {
            try {
              api.flash(x, y, z, color, power * 0.55);
            } catch {
              /* the light has already gone */
            }
          }, 36 + i * 28);
        }
        if (!shape.ranged) {
          window.setTimeout(() => {
            try {
              api.flash((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2, color, power * 0.4);
            } catch {
              /* gone */
            }
          }, 24);
        }
        for (const mesh of stones) {
          const pos = mesh?.position;
          if (!pos) continue;
          const sx = pos.x - to.x;
          const sz = pos.z - to.z;
          const sd = Math.hypot(sx, sz);
          if (sd > 0.02 && sd < Math.max(0.45, bodyLen(defendSlot.fig))) {
            pos.x += (sx / sd) * 0.16;
            pos.z += (sz / sd) * 0.16;
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
              /* gone */
            }
          }, 700);
        } catch {
          /* no glow */
        }
      }
      const struck = event.attackId === "knit" || event.attackId === "dot" ? actorIsLeft : !actorIsLeft;
      const hue = event.element || (struck ? (actorIsLeft ? left.element : right.element) : actor.element);
      const struckIndex = struck ? 0 : 1;
      if (marks[struckIndex]) marks[struckIndex]!.glow = 1.7;
      veil.style.setProperty("--hit", rgba(hue, 0.55));
      veil.classList.add("on");
      window.setTimeout(() => veil.classList.remove("on"), 60);
      strip.classList.remove("hurt-l", "hurt-r");
      strip.classList.add(struck ? "hurt-l" : "hurt-r");
      line.style.color = tint(hue);
      (struck ? barL : barR).classList.add("flash");
      window.setTimeout(() => (struck ? barL : barR).classList.remove("flash"), 220);
      const landed = event.attackId === "knit" ? "knits" : event.attackId === "dot" ? "lingers" : event.ko ? "fells" : "lands";
      paint(
        event.damage
          ? `${event.attackName} ${landed} ${event.damage}${event.aside ? `. ${event.aside}` : ""}`
          : event.attackName,
      );
      const pt = hitTo ? project(hitTo.x, hitTo.y + 0.25, hitTo.z) : null;
      const box = app.getBoundingClientRect();
      const px = pt?.x ?? box.width * (struck ? 0.3 : 0.7);
      const py = pt?.y ?? box.height * 0.46;
      const mark = event.attackId === "knit" ? `+${event.damage ?? 0}` : event.ko ? `${event.damage ?? 0}` : `−${event.damage ?? 0}`;
      pop.style.left = `${px}px`;
      pop.style.top = `${py}px`;
      pop.style.setProperty("--hit", tint(hue));
      popNum.textContent = mark;
      pop.classList.remove("on");
      void pop.offsetWidth;
      pop.classList.add("on");
      return screenAim(actorIsLeft, hitFrom, hitTo);
    },
    finish(winnerId: string | null) {
      const win = winnerId === left.id ? slots[0] : winnerId === right.id ? slots[1] : undefined;
      const lose = winnerId === left.id ? slots[1] : winnerId === right.id ? slots[0] : undefined;
      const mass = (c: Companion): MassClass => (c.sizeM > 2.2 ? "heavy" : c.sizeM < 0.9 ? "light" : "medium");
      if (win) playOwnedAct(win.anim, ["display", "rear", "glow_pulse", "wing_stretch", "hover_bob"], mass(winnerId === left.id ? left : right));
      if (lose) playOwnedAct(lose.anim, ["withdraw", "lie", "burrow", "coil", "shake_off"], mass(winnerId === left.id ? right : left));
      const name = winnerId === left.id ? left.name : winnerId === right.id ? right.name : "";
      paint(name ? `${name} stands.` : "Neither falls.");
      drama = 0;
    },
    close() {
      if (closed) return;
      closed = true;
      running = false;
      if (raf) cancelAnimationFrame(raf);
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
          /* already idle */
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
        /* the notes stay as they are */
      }
      try {
        stage?.setAutoRotate?.(wasSpinning);
      } catch {
        /* the turntable stays */
      }
      if (stage && keepInsets) stage.setInsets = keepInsets;
      settle(false);
    },
  };
}
