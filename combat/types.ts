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
}

export interface DefenseSpecial {
  id: string;
  name: string;
  description: string;
  value: number;
}

export interface DefenseProfile {
  hp: number;
  armor: number;
  knockbackResist: number;
  elementalResist: Record<string, number>;
  specials: DefenseSpecial[];
  massClass: MassClass;
  notes: string[];
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
  stats?: Record<string, number>;
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
