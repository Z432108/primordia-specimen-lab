import type { Attack, CombatPhenotype, DefenseProfile, DefenseSpecial, MassClass } from "./types.ts";
import { BUILD_MASS, COVERING_ARMOR, ELEMENT_RESIST, isLargeBuild } from "./tables.ts";
import { ADJ, fieldHash, matchVariant, motionForAnimation, wardPresentation, type MannerId } from "./catalogue.ts";
import { armorCut, expectedThreat } from "./battle.ts";

const NOUN: Record<string, string> = {
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
  relic_invoke: "Relic",
};

const ORGAN_NAME: Record<string, string> = {
  wings: "Pinion Wake",
  vents: "Vent Flare",
  siphon: "Siphon Draught",
  sails: "Sail Bloom",
  levitator: "Gravetic Drop",
};

const USE_TYPE: Record<string, Attack["type"]> = {
  smash: "slam",
  brawl: "slam",
  reach: "melee",
  gust: "projectile",
  light: "special",
  focus: "special",
  steady: "special",
  guard: "special",
};

const MATTER_ELEMENT: Record<string, string> = {
  wood: "plant",
  bone: "beast",
  stone: "earth",
  metal: "metal",
  crystal: "earth",
  ice: "ice",
  chitin: "beast",
};

interface Draft {
  template: string;
  type: Attack["type"];
  element: string;
  basePower: number;
  range: number;
  cooldown: number;
  aoeRadius?: number;
  hits?: number;
  animationKey: string;
  effectStyle: string;
  flags: string[];
  priority: number;
  name?: string;
  description?: string;
  element2?: string;
}

export function statMul(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return 1;
  // Lab stats are 0–100. A multiplier sits near 1.
  if (value > 3) return 0.7 + (Math.min(100, Math.max(0, value)) / 100) * 0.7;
  return Math.max(0.15, value);
}

export function massFactorOf(sizeM: number, build?: string): number {
  const key = build && BUILD_MASS[build] != null ? build : "medium";
  return Math.pow(Math.max(0.15, sizeM), 0.65) * BUILD_MASS[key]!;
}

export function massClassOf(factor: number): MassClass {
  if (factor < 1.05) return "light";
  if (factor < 1.85) return "medium";
  return "heavy";
}

/** Mass still tells. It no longer decides the fight by itself. */
export function combatScale(factor: number): number {
  return Math.pow(Math.max(0.35, factor), 0.26);
}

export function techniqueBorne(
  ph: CombatPhenotype,
  tech: { gate: string; element: string; organ?: string; relicUse?: string },
): boolean {
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

function mannerFor(ph: CombatPhenotype): MannerId {
  const mass = massClassOf(massFactorOf(ph.sizeM, ph.build));
  if (mass === "heavy") return "charged";
  if (mass === "light") return "quick";
  if (hasFeature(ph, /sting|manticore|venom/) || ph.element === "plant") return "echoing";
  return "measured";
}

function wear(ph: CombatPhenotype, attack: Attack, manner: MannerId): Attack {
  const tech = matchVariant({
    template: attack.template,
    element: attack.element,
    manner,
    organ: attack.template === "organ_pulse" ? ph.ascent?.organ : undefined,
    relicUse: attack.template === "relic_invoke" ? ph.ascent?.relic?.use : undefined,
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
    fxSeed: tech?.fxSeed ?? fieldHash(`${attack.template}:${attack.element}:${manner}`),
  };
}

function compressKit(attacks: Attack[], mass: MassClass): void {
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

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function title(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function countUnits(ph: CombatPhenotype, ...names: string[]): number {
  let n = 0;
  for (const u of ph.units) {
    const unit = (u.unit || "").toLowerCase();
    const role = (u.role || "").toLowerCase();
    if (names.includes(unit) || names.includes(role)) n += u.count ?? 1;
  }
  return n;
}

function hasFeature(ph: CombatPhenotype, re: RegExp): boolean {
  return (ph.features ?? []).some((f) => re.test(f));
}

function clawish(claws?: string): boolean {
  if (!claws || claws === "none") return false;
  return /claw|talon|pincer|scythe|hook/.test(claws);
}

/** Breath style: organ, then crest, then a large build, else the element. */
export function breathStyle(ph: CombatPhenotype): "breath_stream" | "breath_cone" | "breath_burst" {
  if (ph.ascent?.organ) return "breath_burst";
  if (countUnits(ph, "crest") > 0) return "breath_cone";
  if (isLargeBuild(ph.build, ph.sizeM)) return "breath_stream";
  const el = ph.element;
  if (el === "fire" || el === "plasma" || el === "electric" || el === "water") return "breath_stream";
  if (el === "ice" || el === "air" || el === "plant" || el === "light") return "breath_cone";
  return "breath_burst";
}

function named(template: string, element: string, override?: string): string {
  if (override) return override;
  const adj = ADJ[element] ?? title(element);
  const noun = NOUN[template] ?? title(template);
  return `${adj} ${noun}`;
}

function describe(d: Draft, ph: CombatPhenotype): string {
  if (d.description) return d.description;
  const el = d.element;
  switch (d.template) {
    case "spike_volley":
      return `Horns loose a volley of ${el} spikes. The weight of the body carries them.`;
    case "horn_thrust":
      return `A single horn drives forward in a ${el} thrust.`;
    case "spine_barrage":
      return `Spines along the back loose a short ${el} barrage.`;
    case "tentacle_slam":
      return `The tentacles come down together and pin what they strike.`;
    case "tentacle_whip":
      return `A tentacle cracks outward, longer than the body is.`;
    case "claw_arc": {
      const label = (ph.claws ?? "claws").replaceAll("_", " ");
      return `A ${label} cuts a ${el} arc.`;
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
      return `The hide sheds ${el} shards. Heavier bodies throw more of them.`;
    case "breath_stream":
      return `A sustained ${el} breath, held in a stream.`;
    case "breath_cone":
      return `A ${el} breath that opens into a cone.`;
    case "breath_burst":
      return `A short ${el} breath, spent all at once.`;
    case "body_charge":
      return `The whole body is the weapon. Heavier builds arrive slower and hit harder.`;
    case "dual_cast":
      return `${title(ph.element)} and ${title(ph.element2 ?? el)} leave the body together.`;
    case "organ_pulse":
      return `The ascent organ discharges.`;
    case "relic_invoke":
      return `The relic is used as the body knows how.`;
    default:
      return `A ${d.type} wrought from the ${el} of the body.`;
  }
}

function push(out: Draft[], d: Draft) {
  out.push(d);
}

export function generateAttacks(ph: CombatPhenotype): Attack[] {
  const element = ph.element || "beast";
  const drafts: Draft[] = [];
  const horns = countUnits(ph, "horn", "horns");
  const tentacles = countUnits(ph, "tentacle", "tentacles");
  const wings = countUnits(ph, "wing", "wings");
  const tails = countUnits(ph, "tail", "tails");
  const fins = countUnits(ph, "fin", "fins");
  const spines =
    countUnits(ph, "spine", "quill") + (hasFeature(ph, /quill|spine|spike/) ? 1 : 0);
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
      priority: 0,
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
      priority: 0,
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
      priority: 0,
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
      priority: 0,
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
      priority: 0,
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
      priority: 0,
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
      priority: 0,
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
      priority: 0,
    });
  }

  if (tails > 0) {
    const sting = hasFeature(ph, /sting|manticore/) || (ph.units.some((u) => /sting/.test(u.role ?? "")));
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
        priority: 0,
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
      priority: 0,
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
      priority: 0,
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
      priority: 0,
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
      priority: 0,
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
    aoeRadius: style === "breath_burst" ? 2.4 : style === "breath_cone" ? 1.8 : undefined,
    animationKey: style,
    effectStyle: style.replace("_", "-"),
    flags: ["elemental"],
    priority: 0,
  });

  if (ph.element2 && ph.element2 !== element) {
    push(drafts, {
      template: "dual_cast",
      type: "special",
      element: ph.element2,
      basePower: 24,
      range: 5,
      cooldown: 4,
      animationKey: breathStyle({ ...ph, element: ph.element2, ascent: { ...ph.ascent, organ: undefined } }),
      effectStyle: "twin",
      flags: ["dual", "priority", "elemental"],
      priority: 2,
      element2: element,
      name: `${ADJ[element] ?? title(element)}–${ADJ[ph.element2] ?? title(ph.element2)} Twin`,
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
      flags: ["ascent", ...(high ? ["priority"] : [])],
      priority: high ? 3 : 1,
      name: ORGAN_NAME[organ] ?? `${title(organ)} Pulse`,
      description:
        organ === "vents"
          ? "Dorsal vents open and throw a charged plume."
          : organ === "siphon"
            ? "The siphon draws, then expels a compressed draught."
            : organ === "sails"
              ? "Membrane sails snap full and shed a cutting sheet."
              : organ === "levitator"
                ? "The levitator lets go. Bent air drops as weight."
                : organ === "wings"
                  ? "The ascent organ unfurls and throws a pressure wave."
                  : "The ascent organ discharges.",
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
      name: `${title(relic.kind)} · ${relic.use}`,
      description:
        relic.use === "smash"
          ? "The relic comes down with the weight of the wielder."
          : relic.use === "gust"
            ? "The relic raises a cutting gust."
            : relic.use === "reach"
              ? "The relic strikes past the reach of the limbs."
              : relic.use === "brawl"
                ? "The relic is worn on the limbs and makes the next blow heavier."
                : relic.use === "guard"
                  ? "The relic flares a ward, then answers."
                  : relic.use === "light"
                    ? "The relic kindles and throws a hard light."
                    : relic.use === "focus"
                      ? "The relic gathers the element's charge into one point."
                      : "The relic plants and sends a shock through the ground.",
    });
  }

  const templates = new Set(drafts.map((d) => d.template));
  const weapons = drafts.filter(
    (d) =>
      !d.template.startsWith("breath") &&
      d.template !== "dual_cast" &&
      d.template !== "organ_pulse" &&
      d.template !== "relic_invoke",
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
      priority: 0,
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
      priority: 0,
    });
  }

  drafts.sort(
    (a, b) => b.priority - a.priority || b.basePower - a.basePower || a.template.localeCompare(b.template),
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
        element2: d.element2,
      },
      manner,
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

function addResist(map: Record<string, number>, element: string, amount: number) {
  map[element] = round2(clamp((map[element] ?? 0) + amount, -0.6, 0.75));
}

export function generateDefense(ph: CombatPhenotype): DefenseProfile {
  const covering = ph.covering?.type ?? "skin";
  const factor = massFactorOf(ph.sizeM, ph.build);
  const massClass = massClassOf(factor);
  let material = COVERING_ARMOR[covering] ?? 0.04;
  const sculpture = ph.shell?.sculpture ?? [];
  if (sculpture.includes("spines") || sculpture.includes("knobs")) material += 0.04;
  if (ph.shell && covering !== "shell" && covering !== "plate") material += 0.06;
  if (ph.stats?.guard != null) material *= 0.9 + 0.15 * statMul(ph.stats.guard);
  material = round2(clamp(material, 0, 0.82));
  const armor = round2(armorCut(material));

  const wings = countUnits(ph, "wing", "wings");
  let knockback = 0.12 + Math.min(0.55, factor * 0.14) + material * 0.28;
  if (massClass === "light" && wings > 0) knockback *= 0.72;
  const knockbackResist = round2(clamp(knockback, 0.05, 0.94));

  const elementalResist: Record<string, number> = {};
  const innate = ELEMENT_RESIST[ph.element];
  if (innate) for (const [k, v] of Object.entries(innate)) addResist(elementalResist, k, v);
  if (ph.element2 && ph.element2 !== ph.element && ELEMENT_RESIST[ph.element2]) {
    for (const [k, v] of Object.entries(ELEMENT_RESIST[ph.element2]!)) addResist(elementalResist, k, v * 0.5);
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

  const specials: DefenseSpecial[] = [];
  if (covering === "shell" || covering === "plate" || ph.shell) {
    specials.push({
      id: "carapace",
      name: "Carapace",
      description: "The shell or plate turns a share of each blow.",
      value: armor,
    });
  }
  if (massClass === "heavy") {
    specials.push({
      id: "immovable",
      name: "Immovable mass",
      description: "A heavy body gives ground slowly.",
      value: knockbackResist,
    });
  }
  if (covering === "slime") {
    specials.push({
      id: "mucus",
      name: "Mucus sheath",
      description: "A wet coat shrugs water and clings to what strikes it.",
      value: round2(0.12),
    });
  }
  if (massClass === "light" && wings > 0) {
    specials.push({
      id: "slip",
      name: "Aerial slip",
      description: "Light wings shed a shove instead of taking it.",
      value: round2(1 - knockbackResist),
    });
  }
  if (countUnits(ph, "horn", "spine", "quill") > 0 || sculpture.includes("spines") || hasFeature(ph, /quill|spine/)) {
    specials.push({
      id: "thorns",
      name: "Retaliatory thorns",
      description: "Horns or spines return a little of a blow that lands.",
      value: round2(0.08 + Math.min(0.12, countUnits(ph, "horn", "spine") * 0.02)),
    });
  }
  if (ph.ascent?.organ) {
    specials.push({
      id: "ascent-ward",
      name: "Ascent ward",
      description: `The ${ph.ascent.organ} organ holds a ward while it is quiet.`,
      value: round2(0.06 + (ph.ascent.level ?? 1) * 0.03),
    });
  }
  if (ph.ascent?.relic) {
    specials.push({
      id: "relic-aegis",
      name: "Relic aegis",
      description: `The ${ph.ascent.relic.kind} answers when the body is pressed.`,
      value: ph.ascent.relic.held ? 0.12 : 0.06,
      aspect: ph.ascent.relic.use,
    });
  }
  if ((covering === "bark" || ph.element === "plant") && (ph.stats?.vigor ?? 1) >= 1) {
    specials.push({
      id: "sap-knit",
      name: "Sap knit",
      description: "Living tissue closes slowly over a shallow wound.",
      value: round2(massClass === "heavy" ? 0.07 : massClass === "light" ? 0.04 : 0.05),
    });
  }

  const weak = Object.entries(elementalResist)
    .filter(([, v]) => v < 0)
    .sort((a, b) => a[1] - b[1])[0];
  const named = specials.map((s) => {
    const presented = wardPresentation(s.id, {
      element: ph.element || "beast",
      covering,
      mass: massClass,
      organ: ph.ascent?.organ,
      relicMatter: ph.ascent?.relic?.matter,
      relicUse: ph.ascent?.relic?.use,
    });
    return presented ? { ...s, name: presented.name, description: presented.description } : s;
  });
  const notes = [
    `${title(massClass)} body, ${ph.sizeM.toFixed(2)} m, build ${ph.build ?? "medium"}.`,
    `${title(covering)} hide turns aside about ${Math.round(armor * 100)}% of a blow.`,
  ];
  if (weak) notes.push(`${title(weak[0])} bites harder than the rest.`);
  if (ph.element2) notes.push(`A second element, ${ph.element2}, shares the ward.`);

  const initiative = ph.stats?.swift != null ? statMul(ph.stats.swift) : undefined;
  const focus = ph.stats?.focus != null ? statMul(ph.stats.focus) : undefined;
  const edge = ph.stats?.power != null ? statMul(ph.stats.power) : undefined;
  const airborne = Boolean(ph.volant) || (wings > 0 && massClass === "light");
  return { hp, armor, knockbackResist, elementalResist, specials: named, massClass, notes, initiative, focus, edge, airborne };
}

/** Same body, same kit. A short signature for the ledger. */
export function kitSignature(attacks: Attack[], defense: DefenseProfile): string {
  const raw = [
    ...attacks.map((a) => `${a.template}:${a.element}:${a.power}:${a.animationKey}`),
    `hp${defense.hp}`,
    `ar${defense.armor}`,
    defense.massClass,
    ...defense.specials.map((s) => s.id),
  ].join("|");
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) h = Math.imul(h ^ raw.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function attachCombat<T extends object>(record: T, ph: CombatPhenotype): T & {
  attacks: Attack[];
  defense: DefenseProfile;
} {
  return { ...record, attacks: generateAttacks(ph), defense: generateDefense(ph) };
}
