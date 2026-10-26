/** The field of arms: every performance a body might know, not the six it carries. */

import type { AttackType } from "./types.ts";

export const ELEMENTS = [
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
  "beast",
] as const;

export type ElementId = (typeof ELEMENTS)[number];

export const MANNERS = ["quick", "measured", "charged", "echoing"] as const;
export type MannerId = (typeof MANNERS)[number];

export const MOTIONS = [
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
  "brume",
] as const;

export type MotionId = (typeof MOTIONS)[number];

export const ADJ: Record<string, string> = {
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
  beast: "Feral",
};

const MANNER_ADJ: Record<MannerId, string> = {
  quick: "Flickering",
  measured: "Held",
  charged: "Gathered",
  echoing: "Returning",
};

const ELEMENT_LINE: Record<string, string> = {
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
  beast: "Muscle and breath, and the plain decision to close.",
};

const MANNER_LINE: Record<MannerId, string> = {
  quick: "It spends itself early.",
  measured: "It is given at the body's ordinary pace.",
  charged: "It is held back, and arrives heavier.",
  echoing: "A little of it remains, and keeps working.",
};

export interface Technique {
  id: string;
  template: string;
  name: string;
  type: AttackType;
  element: string;
  manner: MannerId;
  motion: MotionId;
  animationKey: string;
  effectStyle: string;
  fxSeed: number;
  basePower: number;
  range: number;
  cooldown: number;
  aoeRadius?: number;
  hits?: number;
  flags: string[];
  description: string;
  gate: string;
  organ?: string;
  relicUse?: string;
  noun: string;
}

interface FormDef {
  template: string;
  noun: string;
  type: AttackType;
  motion: MotionId;
  gate: string;
  basePower: number;
  range: number;
  cooldown: number;
  aoeRadius?: number;
  hits?: number;
  flags: string[];
  blurb: string;
  animationKey: string;
  organ?: string;
  relicUse?: string;
}

const FORMS: FormDef[] = [
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
  { template: "relic_invoke", noun: "Buckler", type: "special", motion: "wall", gate: "relic", basePower: 18, range: 1.8, cooldown: 3, flags: ["relic"], blurb: "The relic flares a ward, and then it answers.", animationKey: "relic_use", relicUse: "guard" },
];

export function fieldHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function title(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function buildAttacks(): Technique[] {
  const out: Technique[] = [];
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
          noun: form.noun,
        });
      }
    }
  }
  return out;
}

export const ATTACK_LEXICON: Technique[] = buildAttacks();

const ATTACK_INDEX = new Map<string, Technique>();
for (const tech of ATTACK_LEXICON) {
  ATTACK_INDEX.set(`${tech.template}|${tech.element}|${tech.manner}|${tech.organ ?? ""}|${tech.relicUse ?? ""}`, tech);
}

export function matchVariant(q: {
  template: string;
  element: string;
  manner: MannerId;
  organ?: string;
  relicUse?: string;
}): Technique | undefined {
  return ATTACK_INDEX.get(`${q.template}|${q.element}|${q.manner}|${q.organ ?? ""}|${q.relicUse ?? ""}`);
}

export function motionForAnimation(key: string): MotionId {
  const found = ATTACK_LEXICON.find((t) => t.animationKey === key);
  return found?.motion ?? "burst";
}

export interface Ward {
  id: string;
  family: string;
  name: string;
  element: string;
  mass?: string;
  covering?: string;
  grade?: string;
  organ?: string;
  relicMatter?: string;
  relicUse?: string;
  motion: "aegis" | "thorn" | "knit" | "slip";
  fxSeed: number;
  description: string;
  value: number;
}

const COVERINGS = ["skin", "fur", "feather", "scale", "chitin", "bark", "slime", "shell", "plate"] as const;
const COVER_NOUN: Record<string, string> = {
  skin: "Hide",
  fur: "Pelt",
  feather: "Plumage",
  scale: "Mail",
  chitin: "Cuirass",
  bark: "Cortex",
  slime: "Sheath",
  shell: "Shell",
  plate: "Plate",
};
const MASS_NAME: Record<string, string> = { light: "Veil", medium: "Mantle", heavy: "Bastion" };
const ORGAN_NOUN: Record<string, string> = {
  wings: "Wake",
  vents: "Plume",
  siphon: "Draught",
  sails: "Bloom",
  levitator: "Drop",
};
const RELIC_MATTER = ["wood", "bone", "stone", "metal", "crystal", "ice", "chitin"] as const;
const MATTER_WORD: Record<string, string> = {
  wood: "Greenwood",
  bone: "Ossuary",
  stone: "Lithic",
  metal: "Ferrous",
  crystal: "Lucent",
  ice: "Hyaline",
  chitin: "Sclerite",
};
const RELIC_USES: Array<{ use: string; noun: string }> = [
  { use: "smash", noun: "Idol" },
  { use: "brawl", noun: "Gauntlet" },
  { use: "reach", noun: "Reach" },
  { use: "gust", noun: "Banner" },
  { use: "light", noun: "Lamp" },
  { use: "focus", noun: "Lens" },
  { use: "steady", noun: "Anchor" },
  { use: "guard", noun: "Buckler" },
];

function ward(partial: Omit<Ward, "fxSeed"> & { fxSeed?: number }): Ward {
  return { ...partial, fxSeed: partial.fxSeed ?? fieldHash(partial.id) };
}

function buildWards(): Ward[] {
  const out: Ward[] = [];
  for (const covering of COVERINGS) {
    for (const element of ELEMENTS) {
      for (const mass of ["light", "medium", "heavy"] as const) {
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
            value: mass === "heavy" ? 0.16 : mass === "medium" ? 0.1 : 0.06,
          }),
        );
      }
    }
  }
  for (const element of ELEMENTS) {
    const adj = ADJ[element];
    for (const [grade, word, value] of [
      ["sparse", "Sparse", 0.06],
      ["thick", "Thick", 0.1],
      ["barbed", "Barbed", 0.12],
    ] as const) {
      out.push(
        ward({
          id: `thorns:${element}:${grade}`,
          family: "thorns",
          name: `${word} ${adj} Thorn`,
          element,
          grade,
          motion: "thorn",
          description: `${word} ${adj.toLowerCase()} points return a little of a blow that lands. Not the blow. A little.`,
          value,
        }),
      );
    }
    for (const [grade, word] of [
      ["slow", "Slow"],
      ["deep", "Deep"],
      ["bright", "Bright"],
    ] as const) {
      out.push(
        ward({
          id: `knit:${element}:${grade}`,
          family: "sap-knit",
          name: `${word} ${adj} Knit`,
          element,
          grade,
          motion: "knit",
          description: `${word} ${adj.toLowerCase()} tissue closes a little over a shallow wound, and then it stops.`,
          value: 0.05,
        }),
      );
    }
    for (const [grade, word] of [
      ["soft", "Soft"],
      ["sheer", "Sheer"],
      ["wild", "Wild"],
    ] as const) {
      out.push(
        ward({
          id: `slip:${element}:${grade}`,
          family: "slip",
          name: `${word} ${adj} Slip`,
          element,
          grade,
          motion: "slip",
          description: `A ${word.toLowerCase()} ${adj.toLowerCase()} slip sheds a shove instead of taking it.`,
          value: 0.2,
        }),
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
        value: 0.7,
      }),
    );
    out.push(
      ward({
        id: `mucus:${element}`,
        family: "mucus",
        name: `${adj} Mucus`,
        element,
        motion: "aegis",
        description: `A ${adj.toLowerCase()} coat shrugs a little water and clings to what strikes it.`,
        value: 0.12,
      }),
    );
    out.push(
      ward({
        id: `temper:${element}`,
        family: "temper",
        name: `${adj} Temper`,
        element,
        motion: "aegis",
        description: `The body is ${adj.toLowerCase()} in its temper. What matches it bites less. What opposes it bites more.`,
        value: 0.2,
      }),
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
          value: 0.08,
        }),
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
          value: 0.08,
        }),
      );
    }
  }
  return out;
}

export const WARD_LEXICON: Ward[] = buildWards();

const WARD_BY_FAMILY = new Map<string, Ward[]>();
for (const w of WARD_LEXICON) {
  const list = WARD_BY_FAMILY.get(w.family) ?? [];
  list.push(w);
  WARD_BY_FAMILY.set(w.family, list);
}

export function wardPresentation(
  family: string,
  hints: {
    element: string;
    covering?: string;
    mass?: string;
    organ?: string;
    relicMatter?: string;
    relicUse?: string;
  },
): Ward | undefined {
  const list = WARD_BY_FAMILY.get(family);
  if (!list?.length) return undefined;
  const element = hints.element || "beast";
  const mass = hints.mass ?? "medium";
  const grade = mass === "light" ? "sparse" : mass === "heavy" ? "thick" : "barbed";
  const knitGrade = mass === "light" ? "slow" : mass === "heavy" ? "deep" : "bright";
  const slipGrade = mass === "light" ? "soft" : mass === "heavy" ? "wild" : "sheer";
  return (
    list.find((w) => {
      if (w.element !== element && family !== "relic-aegis") return false;
      if (family === "carapace") return w.covering === (hints.covering ?? "skin") && w.mass === mass;
      if (family === "thorns") return w.grade === grade;
      if (family === "sap-knit") return w.grade === knitGrade;
      if (family === "slip") return w.grade === slipGrade;
      if (family === "ascent-ward") return w.organ === hints.organ;
      if (family === "relic-aegis") return w.relicMatter === hints.relicMatter && w.relicUse === hints.relicUse;
      return true;
    }) ?? list.find((w) => w.element === element) ?? list[0]
  );
}
