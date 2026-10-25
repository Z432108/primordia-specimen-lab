import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toCombatPhenotype } from "./adapter.ts";
import { resolveBattle, strikeDamage } from "./battle.ts";
import { breathStyle, generateAttacks, generateDefense, kitSignature } from "./generate.ts";
import type { Attack, CombatPhenotype, DefenseProfile } from "./types.ts";

function ph(partial: Partial<CombatPhenotype> & Pick<CombatPhenotype, "element" | "sizeM">): CombatPhenotype {
  return {
    covering: { type: "skin" },
    build: "medium",
    units: [],
    ...partial,
  };
}

const hornedCrystal = ph({
  element: "earth",
  element2: "metal",
  sizeM: 3.4,
  build: "colossus",
  covering: { type: "plate" },
  units: [{ unit: "horn", role: "antler", count: 4 }],
  shell: { sculpture: ["spines", "knobs"] },
  stats: { power: 1.15, vigor: 1.3 },
});

const smallHorned = ph({
  element: "earth",
  sizeM: 0.7,
  build: "lithe",
  covering: { type: "plate" },
  units: [{ unit: "horn", role: "antler", count: 2 }],
  stats: { power: 1, vigor: 1 },
});

const tentacleWater = ph({
  element: "water",
  sizeM: 2.4,
  build: "brawler",
  covering: { type: "slime" },
  loco: "Swim",
  units: [
    { unit: "tentacle", role: "sucker", count: 6 },
    { unit: "fin", role: "paddle", count: 2 },
  ],
});

const wingedVoid = ph({
  element: "void",
  sizeM: 1.05,
  build: "wraith",
  covering: { type: "skin" },
  loco: "Hover",
  units: [
    { unit: "wing", role: "bat", count: 2 },
    { unit: "tail", count: 1 },
  ],
});

const plain = ph({
  element: "beast",
  sizeM: 0.55,
  build: "lithe",
  covering: { type: "skin" },
  units: [],
});

const crestedFire = ph({
  element: "fire",
  sizeM: 2.5,
  build: "guardian",
  covering: { type: "scale" },
  units: [
    { unit: "crest", count: 1 },
    { unit: "wing", count: 2 },
    { unit: "horn", count: 2 },
  ],
  features: ["fang"],
});

describe("generateAttacks", () => {
  it("gives a horned heavy crystal a spike volley that outscales a small horned cousin", () => {
    const heavy = generateAttacks(hornedCrystal);
    const light = generateAttacks(smallHorned);
    const hv = heavy.find((a) => a.template === "spike_volley");
    const lv = light.find((a) => a.template === "spike_volley");
    assert.ok(hv);
    assert.ok(lv);
    assert.ok(heavy.some((a) => a.template === "surface_shard"));
    assert.equal(breathStyle(hornedCrystal), "breath_stream");
    assert.ok(hv.power > lv.power);
    assert.ok(heavy.length >= 3 && heavy.length <= 6);
  });

  it("gives a multi-tentacle swimmer a slam and a whip", () => {
    const attacks = generateAttacks(tentacleWater);
    assert.ok(attacks.some((a) => a.template === "tentacle_slam"));
    assert.ok(attacks.some((a) => a.template === "tentacle_whip"));
    assert.equal(breathStyle(tentacleWater), "breath_stream");
    const defense = generateDefense(tentacleWater);
    assert.ok(defense.specials.some((s) => s.id === "mucus"));
  });

  it("gives a lean winged void a buffet and a burst, and calls it light", () => {
    const attacks = generateAttacks(wingedVoid);
    assert.ok(attacks.some((a) => a.template === "wing_buffet" && a.animationKey === "wing_flap"));
    assert.equal(breathStyle(wingedVoid), "breath_burst");
    assert.ok(attacks.some((a) => a.template === "breath_burst"));
    assert.equal(generateDefense(wingedVoid).massClass, "light");
    assert.ok(generateDefense(wingedVoid).specials.some((s) => s.id === "slip"));
  });

  it("still arms a body with no weapons", () => {
    const attacks = generateAttacks(plain);
    assert.ok(attacks.some((a) => a.template === "basic_bite"));
    assert.ok(attacks.some((a) => a.template === "body_charge"));
    assert.ok(attacks.length >= 3 && attacks.length <= 6);
    const defense = generateDefense(plain);
    assert.equal(defense.specials.some((s) => s.id === "carapace"), false);
    assert.equal(defense.specials.some((s) => s.id === "thorns"), false);
  });

  it("lets a crest choose a cone, and keeps dual and high-ascent organs inside a crowded kit", () => {
    assert.equal(breathStyle(crestedFire), "breath_cone");
    const crowded = ph({
      element: "fire",
      element2: "air",
      sizeM: 2.8,
      build: "titan",
      covering: { type: "scale" },
      units: [
        { unit: "horn", count: 4 },
        { unit: "tentacle", count: 4 },
        { unit: "wing", count: 2 },
        { unit: "tail", count: 1 },
        { unit: "crest", count: 1 },
        { unit: "spine", count: 3 },
      ],
      claws: "talon",
      features: ["sting"],
      ascent: { organ: "vents", level: 4, relic: { kind: "spear", matter: "bone", use: "smash", held: true } },
    });
    const attacks = generateAttacks(crowded);
    assert.equal(attacks.length, 6);
    assert.ok(attacks.some((a) => a.template === "organ_pulse"));
    assert.ok(attacks.some((a) => a.template === "dual_cast"));
    assert.equal(breathStyle(crowded), "breath_burst");
  });

  it("is deterministic", () => {
    const a = generateAttacks(hornedCrystal);
    const b = generateAttacks(hornedCrystal);
    assert.deepEqual(a, b);
    assert.equal(kitSignature(a, generateDefense(hornedCrystal)), kitSignature(b, generateDefense(hornedCrystal)));
  });
});

describe("generateDefense", () => {
  it("scales hit points and mass class with size and build", () => {
    const heavy = generateDefense(hornedCrystal);
    const light = generateDefense(smallHorned);
    assert.equal(heavy.massClass, "heavy");
    assert.equal(light.massClass, "light");
    assert.ok(heavy.hp > light.hp);
    assert.ok(heavy.armor >= light.armor);
    assert.ok(heavy.specials.some((s) => s.id === "carapace"));
    assert.ok(heavy.specials.some((s) => s.id === "immovable"));
    assert.ok((heavy.elementalResist.earth ?? 0) > 0);
    assert.ok((heavy.elementalResist.air ?? 0) < 0);
  });
});

describe("adapter", () => {
  it("reads a lab phenotype's parts, covering, ascent, and teeth", () => {
    const lab = {
      sizeM: 2.1,
      element: "water",
      element2: "electric",
      covering: { type: "slime", p: { len: 10 } },
      loco: "Swim",
      parts: [
        { sys: "tentacles", fam: "sucker", side: -1, dev: "full" },
        { sys: "tentacles", fam: "sucker", side: 1, dev: "full" },
        { sys: "tentacles", fam: "sucker", side: 0, dev: "full" },
        { sys: "tentacles", fam: "sucker", side: 0, dev: "full" },
        { sys: "arms", fam: "cheliped", term: "pincer", dev: "full" },
        { sys: "dorsal", fam: "shell", sculpture: "spines", dev: "full" },
      ],
      head: { teeth: { type: "needle" } },
      ascent: {
        level: 3,
        build: "brawler",
        organ: "siphon",
        relic: { kind: "orb", matter: "ice", use: "focus", held: 1 },
      },
      line: { vigor: 200 },
    };
    const mapped = toCombatPhenotype(lab, { build: { morph: { shell: { sculpture: "ribs" } } } });
    assert.equal(mapped.element, "water");
    assert.equal(mapped.build, "brawler");
    assert.equal(mapped.claws, "pincer");
    const tentacles = mapped.units.find((u) => u.unit === "tentacle");
    assert.equal(tentacles?.count, 4);
    assert.ok(mapped.features?.includes("needle"));
    assert.ok(mapped.shell?.sculpture?.includes("spines"));
    assert.ok(mapped.shell?.sculpture?.includes("ribs"));
    assert.equal(mapped.ascent?.organ, "siphon");
    assert.equal(mapped.ascent?.relic?.held, true);
    const attacks = generateAttacks(mapped);
    assert.ok(attacks.some((a) => a.template === "tentacle_slam"));
    assert.ok(attacks.some((a) => a.template === "claw_arc"));
    assert.ok(attacks.some((a) => a.template === "organ_pulse"));
  });

  it("defaults a missing phenotype instead of throwing", () => {
    const mapped = toCombatPhenotype({});
    assert.equal(mapped.build, "medium");
    assert.deepEqual(mapped.units, []);
    assert.equal(mapped.covering.type, "skin");
    const attacks = generateAttacks(mapped);
    assert.ok(attacks.length >= 3);
  });
});

describe("battle", () => {
  it("lets armor and resist cut a blow, and finishes a bout", () => {
    const attack: Attack = {
      id: "t:fire:0",
      template: "breath_stream",
      name: "Cinder Stream",
      type: "breath",
      element: "fire",
      basePower: 26,
      power: 40,
      range: 7,
      cooldown: 2,
      animationKey: "breath_stream",
      effectStyle: "breath-stream",
      description: "test",
      flags: [],
    };
    const soft: DefenseProfile = {
      hp: 80,
      armor: 0.05,
      knockbackResist: 0.2,
      elementalResist: {},
      specials: [],
      massClass: "light",
      notes: [],
    };
    const hard: DefenseProfile = {
      hp: 80,
      armor: 0.5,
      knockbackResist: 0.7,
      elementalResist: { fire: 0.3 },
      specials: [],
      massClass: "heavy",
      notes: [],
    };
    assert.ok(strikeDamage(attack, hard) < strikeDamage(attack, soft));
    const result = resolveBattle(
      { id: "a", name: "A", attacks: generateAttacks(hornedCrystal), defense: generateDefense(hornedCrystal) },
      { id: "b", name: "B", attacks: generateAttacks(plain), defense: generateDefense(plain) },
    );
    assert.ok(result.log.length > 0);
    assert.ok(result.winnerId === "a" || result.winnerId === "b" || result.winnerId === null);
    const again = resolveBattle(
      { id: "a", name: "A", attacks: generateAttacks(hornedCrystal), defense: generateDefense(hornedCrystal) },
      { id: "b", name: "B", attacks: generateAttacks(plain), defense: generateDefense(plain) },
    );
    assert.deepEqual(result, again);
  });
});
