import { ANIMATION_KEYS, type MassClass } from "./types.ts";

const KNOWN = new Set<string>(ANIMATION_KEYS);

/** Lab act ids, in the order they should be tried for each driver. */
const ACT_FOR: Record<string, string[]> = {
  horn_thrust: ["horn_rub", "head_toss", "rear"],
  tentacle_chain_slam: ["tentacle_explore", "sway"],
  tentacle_whip: ["tentacle_explore", "shake_off"],
  breath_stream: ["glow_pulse", "display", "flick_tongue"],
  breath_cone: ["display", "glow_pulse"],
  breath_burst: ["glow_pulse", "pulse", "display"],
  claw_arc: ["pounce", "dig", "rear"],
  tail_swipe: ["shake_off", "sway"],
  wing_flap: ["wing_stretch", "hover_bob", "display"],
  surface_shard: ["shake_off", "display"],
  body_charge: ["pounce", "rear", "stretch"],
  organ_activate: ["glow_pulse", "pulse", "display"],
  relic_use: ["raise_relic", "display"],
  jaw_snap: ["yawn", "chew_cud", "flick_tongue"],
  act: ["display", "look_around"],
};

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

/**
 * Play a lab act that stands in for the attack's animation key.
 * Heavier bodies run the act slower and throw a stronger flare.
 * An unknown key falls back to the generic act and is logged.
 */
export function playAttack(
  anim: { act?: (id: string) => boolean; setActs?: (o: { rate: number }) => void; flare?: (k: number) => void; acts?: { rate: number } } | null | undefined,
  animationKey: string,
  mass: MassClass,
): PlayedAttack {
  const resolved = resolveAnimation(animationKey);
  const tries = ACT_FOR[resolved.key] ?? ACT_FOR.act!;
  if (!anim) {
    console.info("combat: missing animation driver", animationKey);
    return { key: "act", fallback: true, act: null };
  }
  const rate = mass === "heavy" ? 0.55 : mass === "light" ? 1.2 : 0.85;
  if (anim.acts) anim.acts.rate = rate;
  else anim.setActs?.({ rate });
  let act: string | null = null;
  for (const id of tries) {
    try {
      if (anim.act?.(id)) {
        act = id;
        break;
      }
    } catch {
      /* this body does not offer the act */
    }
  }
  if (!act) {
    console.info("combat: missing animation driver", animationKey);
    try {
      if (anim.act?.("look_around")) act = "look_around";
    } catch {
      /* no rig */
    }
    return { key: "act", fallback: true, act };
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
