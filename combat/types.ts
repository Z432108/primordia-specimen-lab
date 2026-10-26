/** Morphology-derived combat kit. Pure data — no renderer. */

export type AttackType = "melee" | "projectile" | "breath" | "slam" | "special" | "dot";

export type MassClass = "light" | "medium" | "heavy";

export interface Attack {
  id: string;
  template: string;
  name: string;
  type: AttackType;
  element: string;
  basePower: number;
  power: number;
  range: number;
  cooldown: number;
  aoeRadius?: number;
  hits?: number;
  animationKey: string;
  effectStyle: string;
  description: string;
  flags: string[];
  /** Which performance from the field this blow is wearing. */
  variantId?: string;
  manner?: string;
  fxMotion?: string;
  fxSeed?: number;
  /** The other element, when a twin cast carries both. */
  element2?: string;
}

export interface DefenseSpecial {
  id: string;
  name: string;
  description: string;
  value: number;
  /** Relic use, when this ward is a relic. Decides which blows it answers. */
  aspect?: string;
}

export interface DefenseProfile {
  hp: number;
  armor: number;
  knockbackResist: number;
  elementalResist: Record<string, number>;
  specials: DefenseSpecial[];
  massClass: MassClass;
  notes: string[];
  /** From the lab's power. Applied when the blow lands, so the kit ceiling cannot erase it. */
  edge?: number;
  /** From the lab's swift, when the body has one. Breaks a tie for the first blow. */
  initiative?: number;
  /** From the lab's focus. Shortens a long recovery by one beat, never below one. A keen focus also reads the foe's ward. */
  focus?: number;
  /** Light wings, or a body that is already aloft. Ground slams meet less of it. */
  airborne?: boolean;
}

export interface CombatUnit {
  unit: string;
  role?: string;
  count?: number;
}

export interface CombatRelic {
  kind: string;
  matter: string;
  use: string;
  held?: boolean;
}

export interface CombatPhenotype {
  sizeM: number;
  element: string;
  element2?: string;
  covering: { type: string };
  build?: string;
  units: CombatUnit[];
  features?: string[];
  claws?: string;
  shell?: { sculpture?: string[] };
  ascent?: {
    organ?: string;
    level?: number;
    relic?: CombatRelic;
  };
  loco?: string;
  ecology?: string;
  plan?: string;
  volant?: boolean;
  stats?: Record<string, number>;
  /** The generator's diet. A herbivore does not gain a killing bite from tusks. */
  diet?: string;
  mouth?: string;
  mouths?: number;
  /** The generator's mass. Denser bodies of the same length are harder to spend. */
  massKg?: number;
}

/** Drivers the specimen lab already poses, plus the bite and the generic act. */
export const ANIMATION_KEYS = [
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
  "act",
] as const;

export type AnimationKey = (typeof ANIMATION_KEYS)[number];
