import { ANIMATION_KEYS, type MassClass } from "./types.ts";
import { playFx } from "./fx.ts";

const KNOWN = new Set<string>(ANIMATION_KEYS);

/** Lab act ids, in the order they should be tried for each driver. */
const ACT_FOR: Record<string, string[]> = {
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
  act: ["pounce", "rear", "display", "head_toss"],
};

/** What the blow looks like. Tried before the driver's own list, and only if this body grew the act. */
const MOTION_ACTS: Record<string, string[]> = {
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
  knit: ["glow_pulse", "bask", "pulse", "display"],
};

const QUIET = new Set([
  "sit", "lie", "rest", "look_around", "scan", "scan_dark", "perch_shift",
  "bask", "graze", "filter", "drift", "paddle", "ear_swivel", "antenna_clean", "groom", "preen",
]);

/** Loud poses, used when this body grew none of the named ones. */
const STRIKE = [
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
  "stretch",
];

export const GUARD_ACTS = ["withdraw", "coil", "burrow", "rear", "shake_off", "sway", "display", "look_around"];

function saltRank(salt: string, id: string): number {
  let h = 2166136261;
  const s = `${salt}:${id}`;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Preference order for one blow. A body that grew none of the named acts still gets a different owned pose per motion. */
export function actsForAttack(animationKey: string, motion?: string, owned?: string[]): string[] {
  const key = resolveAnimation(animationKey).key;
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push(id);
  };
  for (const id of MOTION_ACTS[motion ?? ""] ?? []) push(id);
  for (const id of ACT_FOR[key] ?? ACT_FOR.act!) push(id);
  for (const id of STRIKE) push(id);
  if (owned?.length) {
    const loud = owned.filter((id) => !QUIET.has(id));
    const pool = (loud.length ? loud : owned).slice().sort((a, b) => saltRank(`${motion ?? ""}:${key}`, a) - saltRank(`${motion ?? ""}:${key}`, b));
    for (const id of pool) push(id);
  }
  return out;
}

export function resolveAnimation(key: string): { key: string; fallback: boolean } {
  if (KNOWN.has(key)) return { key, fallback: false };
  console.info("combat: missing animation driver", key);
  return { key: "act", fallback: true };
}

export interface PlayedAttack {
  key: string;
  fallback: boolean;
  act: string | null;
}

export interface ActRig {
  act?: (id: string) => boolean;
  setActs?: (o: { rate: number }) => void;
  flare?: (k: number) => void;
  acts?: { rate: number; play?: (id: string, held?: boolean) => boolean; release?: () => void };
  actsAvailable?: () => string[];
}

function ownedIds(anim: ActRig): string[] | null {
  try {
    const list = anim.actsAvailable?.();
    return Array.isArray(list) && list.length ? list : null;
  } catch {
    return null;
  }
}

function holdFor(anim: ActRig, id: string): boolean {
  try {
    if (anim.acts?.play) return Boolean(anim.acts.play(id, true));
    return Boolean(anim.act?.(id));
  } catch {
    return false;
  }
}

/**
 * Play a pose this body actually offers. Held so a walk cycle does not
 * cancel it, then released so the next stride is free.
 */
export function playOwnedAct(anim: ActRig | null | undefined, ids: string[], mass: MassClass): string | null {
  if (!anim) return null;
  const rate = mass === "heavy" ? 0.55 : mass === "light" ? 1.2 : 0.85;
  try {
    if (!anim.acts) anim.setActs?.({ rate });
    if (anim.acts) anim.acts.rate = rate;
  } catch {
    /* this rig has no act layer */
  }
  const owned = ownedIds(anim);
  const seen = new Set<string>();
  let act: string | null = null;
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
      /* the bout already dropped the body */
    }
  }, hold);
  return act;
}

/**
 * Play a lab act that stands in for the attack's animation key.
 * Heavier bodies run the act slower and throw a stronger flare.
 * An unknown key falls back to the generic act and is logged.
 */
export function playAttack(
  anim: ActRig | null | undefined,
  animationKey: string,
  mass: MassClass,
  motion?: string,
): PlayedAttack {
  const resolved = resolveAnimation(animationKey);
  if (!anim) {
    console.info("combat: missing animation driver", animationKey);
    return { key: "act", fallback: true, act: null };
  }
  const owned = ownedIds(anim) ?? undefined;
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
      /* no glow uniform */
    }
    const hold = mass === "heavy" ? 980 : 640;
    setTimeout(() => {
      try {
        anim.flare?.(1);
      } catch {
        /* gone */
      }
    }, hold);
  }
  return { key: resolved.key, fallback: resolved.fallback, act };
}

export function performAttack(
  anim: Parameters<typeof playAttack>[0],
  attack: { animationKey: string; element?: string; fxMotion?: string; fxSeed?: number; name?: string },
  mass: MassClass,
  intensity = 1,
): PlayedAttack {
  const played = playAttack(anim, attack.animationKey, mass, attack.fxMotion);
  if (attack.element && attack.fxMotion) {
    playFx({
      element: attack.element,
      motion: attack.fxMotion,
      seed: attack.fxSeed ?? 1,
      mass,
      title: attack.name,
      intensity,
    });
  }
  return played;
}
