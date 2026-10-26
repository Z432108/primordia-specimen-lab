import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toCombatPhenotype } from "./adapter.ts";
import { blowCap, commit, offers, openRound, resolveBattle, startBout, strikeDamage } from "./battle.ts";
import { ATTACK_LEXICON, MOTIONS, WARD_LEXICON } from "./catalogue.ts";
import { breathStyle, generateAttacks, generateDefense, kitSignature, massClassOf, massFactorOf } from "./generate.ts";
import { chooseLine, gaitOf, hullOf, LIFE_STAGES, supportRadius, touchDistance, type Companion } from "./arena.ts";
import { actsForAttack } from "./animate.ts";
import type { Attack, CombatPhenotype, DefenseProfile, DefenseSpecial } from "./types.ts";

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

  it("reads a grown body the way the generator writes one", () => {
    const grown = {
      stage: "Apex",
      sizeM: 1.7,
      element: "fire",
      element2: "earth",
      ecology: "volcanic",
      plan: "quadruped",
      topo: "T1",
      loco: "QuadGait",
      volant: false,
      covering: { type: "scale" },
      head: { teeth: { type: "tusks", count: 2 } },
      body: { fam: "reptile", p: { musc: 180 } },
      line: { vigor: 200, purity: 160, f: 12 },
      diet: "herbivore",
      massKg: 210,
      myth: [],
      anomaly: [],
      adapt: [{ id: "heatproof" }],
      parts: [
        { sys: "horns", fam: "brow", side: -1 },
        { sys: "horns", fam: "brow", side: 1 },
        { sys: "legs", fam: "digitigrade" },
        { sys: "legs", fam: "digitigrade" },
        { sys: "legs", fam: "digitigrade" },
        { sys: "legs", fam: "digitigrade" },
        { sys: "tails", fam: "club" },
        { sys: "dorsal", fam: "thorns" },
        { sys: "arms", fam: "raptorial", term: "pincer" },
        { sys: "eyes", fam: "camera", dev: "absent" },
      ],
      stats: { power: 52, guard: 34, swift: 41, focus: 22, vigor: 58, spirit: 27 },
    };
    const mapped = toCombatPhenotype(grown);
    assert.equal(mapped.element, "fire");
    assert.equal(mapped.element2, "earth");
    assert.equal(mapped.loco, "QuadGait");
    assert.equal(mapped.ecology, "volcanic");
    assert.equal(mapped.features?.includes("tusks"), false);
    assert.equal(mapped.diet, "herbivore");
    assert.equal(mapped.massKg, 210);
    assert.ok(mapped.features?.includes("heatproof"));
    assert.equal(mapped.units.find((u) => u.unit === "horn")?.count, 2);
    assert.equal(mapped.units.find((u) => u.unit === "spine")?.count, 1);
    assert.equal(mapped.units.find((u) => u.unit === "eye"), undefined);
    assert.equal(mapped.claws, "pincer");
    assert.equal(mapped.stats?.power, 52);
    const attacks = generateAttacks(mapped);
    const defense = generateDefense(mapped);
    assert.ok(attacks.some((a) => a.template === "spike_volley"));
    assert.ok(attacks.some((a) => a.template === "claw_arc"));
    assert.ok(mapped.units.some((u) => u.unit === "tail" && u.role === "club"));
    assert.ok(attacks.some((a) => a.element === "fire"));
    assert.ok(attacks.some((a) => a.flags.includes("dual")));
    assert.equal(attacks.some((a) => a.template === "fang_bite"), false);
    assert.ok(defense.specials.some((s) => s.id === "thorns"));
    const light = generateDefense(toCombatPhenotype({ ...grown, massKg: 18 }));
    assert.ok(defense.hp > light.hp);
    assert.ok((defense.edge ?? 1) > 1);
    assert.equal(defense.elementalResist.fire > 0, true);
    assert.equal((defense.elementalResist.water ?? 0) < 0, true);
  });

  it("grows a kit for every element, covering, and plan the generator can write", () => {
    const elements = ["plant", "fire", "water", "earth", "ice", "electric", "plasma", "air", "metal", "light", "void", "beast"];
    const coverings = ["skin", "fur", "feather", "scale", "chitin", "bark", "slime", "shell", "plate"];
    const plans = ["biped", "quadruped", "hexapod", "swimmer", "serpentine", "floater", "sessile_mass", "radial", "centauroid"];
    const locos = ["BipedWalk", "QuadGait", "MultiLegRipple", "Swim", "Hover", "Sessile", "Slither"];
    for (const element of elements) {
      for (const covering of coverings) {
        for (let n = 0; n < plans.length; n++) {
          const plan = plans[n]!;
          const mapped = toCombatPhenotype({
            sizeM: 0.4 + ((n + element.length) % 5) * 0.5,
            element,
            element2: n % 4 === 0 ? elements[(elements.indexOf(element) + 3) % elements.length] : null,
            covering: { type: covering },
            plan,
            loco: locos[n % locos.length],
            volant: plan === "floater",
            ecology: n % 2 ? "cave" : "reef",
            parts: n % 2 ? [{ sys: "wings", fam: "bat" }, { sys: "wings", fam: "bat" }] : [{ sys: "fins", fam: "frill" }],
            head: { teeth: { type: n % 3 === 0 ? "fangs" : "peg" } },
          });
          const attacks = generateAttacks(mapped);
          const defense = generateDefense(mapped);
          assert.ok(attacks.length >= 3, `${element} ${covering} ${plan}`);
          assert.ok(defense.hp > 0);
          assert.equal(mapped.element, element);
        }
      }
    }
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

  it("will not let one blow spend the whole fight", () => {
    const huge: Attack = {
      id: "huge",
      template: "body_charge",
      name: "Huge",
      type: "slam",
      element: "earth",
      basePower: 400,
      power: 400,
      range: 1,
      cooldown: 1,
      hits: 4,
      animationKey: "body_charge",
      effectStyle: "charge",
      description: "test",
      flags: [],
    };
    const soft: DefenseProfile = {
      hp: 100,
      armor: 0,
      knockbackResist: 0.2,
      elementalResist: {},
      specials: [],
      massClass: "light",
      notes: [],
    };
    const bulky: DefenseProfile = { ...soft, hp: 400, massClass: "heavy" };
    const result = resolveBattle(
      { id: "a", name: "A", attacks: [huge], defense: bulky },
      { id: "b", name: "B", attacks: [huge], defense: soft },
      2,
    );
    const strike = result.log.find((e) => e.actorId === "a" && e.attackId === "huge");
    assert.ok(strike);
    assert.ok(strike.damage <= blowCap(100));
    assert.ok(strike.damage >= 6);
  });

  it("reads a ward, finds a seam, and lets wings and a relic answer", () => {
    const weak: DefenseProfile = {
      hp: 200,
      armor: 0.45,
      knockbackResist: 0.3,
      elementalResist: { fire: -0.3, water: 0.4 },
      specials: [],
      massClass: "medium",
      notes: [],
    };
    const bite: Attack = {
      id: "bite", template: "fang_bite", name: "Bite", type: "melee", element: "water",
      basePower: 30, power: 30, range: 1.2, cooldown: 2, animationKey: "jaw_snap", effectStyle: "bite", description: "", flags: [],
    };
    const breath: Attack = {
      id: "breath", template: "breath_stream", name: "Stream", type: "breath", element: "fire",
      basePower: 22, power: 22, range: 7, cooldown: 4, animationKey: "breath_stream", effectStyle: "stream", description: "", flags: [],
    };
    const dull = resolveBattle(
      { id: "a", name: "A", attacks: [bite, breath], defense: { ...weak, hp: 80, focus: 1 } },
      { id: "b", name: "B", attacks: [bite], defense: weak },
      1,
    );
    const keen = resolveBattle(
      { id: "a", name: "A", attacks: [bite, breath], defense: { ...weak, hp: 80, focus: 1.2 } },
      { id: "b", name: "B", attacks: [bite], defense: weak },
      1,
    );
    assert.equal(dull.log.find((e) => e.actorId === "a")?.attackId, "bite");
    assert.equal(keen.log.find((e) => e.actorId === "a")?.attackId, "breath");
    const plate: DefenseProfile = { ...weak, elementalResist: {}, armor: 0.5 };
    const melee: Attack = { ...breath, id: "ram", type: "melee", template: "body_charge", power: 22, basePower: 22 };
    assert.ok(strikeDamage(breath, plate) > strikeDamage(melee, plate));
    const ground: DefenseProfile = { ...plate, armor: 0, airborne: false };
    const aloft: DefenseProfile = { ...ground, airborne: true };
    const slam: Attack = { ...melee, type: "slam", flags: [] };
    assert.ok(strikeDamage(slam, aloft) < strikeDamage(slam, ground));
    const winged: Attack = { ...slam, flags: ["aerial"] };
    assert.ok(strikeDamage(winged, ground) > strikeDamage(slam, ground));
    const guarded = resolveBattle(
      { id: "a", name: "A", attacks: [bite], defense: { ...weak, hp: 40 } },
      {
        id: "b",
        name: "B",
        attacks: [bite],
        defense: { ...weak, specials: [{ id: "relic-aegis", name: "Relic", description: "", value: 0.12 }] },
      },
      1,
    );
    const answered = guarded.log.find((e) => e.actorId === "a");
    assert.equal(answered?.aside, "The relic answers.");
    const again = guarded.log.filter((e) => e.aside === "The relic answers.");
    assert.equal(again.length, 1);
  });

  it("keeps a twin, a coat, a planted body, and a reaching relic distinct", () => {
    const hide: DefenseProfile = {
      hp: 180,
      armor: 0.2,
      knockbackResist: 0.4,
      elementalResist: { fire: -0.3, water: 0.35 },
      specials: [],
      massClass: "medium",
      notes: [],
    };
    const fire: Attack = {
      id: "fire", template: "breath_stream", name: "Fire", type: "breath", element: "fire",
      basePower: 20, power: 20, range: 6, cooldown: 3, animationKey: "breath_stream", effectStyle: "s", description: "", flags: [],
    };
    const twin: Attack = { ...fire, id: "twin", flags: ["dual"], element2: "water", type: "special" };
    const pure = strikeDamage(fire, hide);
    const mixed = strikeDamage(twin, hide);
    assert.notEqual(pure, mixed);
    const water: Attack = { ...fire, id: "water", element: "water", type: "projectile" };
    const bare = resolveBattle(
      { id: "a", name: "A", attacks: [water], defense: { ...hide, hp: 60 } },
      { id: "b", name: "B", attacks: [water], defense: hide },
      1,
    );
    const coated = resolveBattle(
      { id: "a", name: "A", attacks: [water], defense: { ...hide, hp: 60 } },
      { id: "b", name: "B", attacks: [water], defense: { ...hide, specials: [{ id: "mucus", name: "Mucus", description: "", value: 0.12 }] } },
      1,
    );
    const open = bare.log.find((e) => e.actorId === "a")!;
    const shut = coated.log.find((e) => e.actorId === "a")!;
    assert.ok(shut.damage < open.damage);
    assert.equal(shut.aside, "The coat shrugs it.");
    const slam: Attack = { ...fire, id: "slam", type: "slam", element: "earth", fxMotion: "slam", animationKey: "body_charge" };
    const shoved = resolveBattle(
      { id: "a", name: "A", attacks: [slam], defense: { ...hide, hp: 50 } },
      { id: "b", name: "B", attacks: [slam], defense: hide },
      1,
    );
    const planted = resolveBattle(
      { id: "a", name: "A", attacks: [slam], defense: { ...hide, hp: 50 } },
      { id: "b", name: "B", attacks: [slam], defense: { ...hide, specials: [{ id: "immovable", name: "Mass", description: "", value: 0.7 }] } },
      1,
    );
    assert.ok(planted.log.find((e) => e.actorId === "a")!.damage < shoved.log.find((e) => e.actorId === "a")!.damage);
    const bite: Attack = { ...fire, id: "bite", type: "melee", range: 1.2, element: "beast", fxMotion: "bite" };
    const reach: DefenseSpecial = { id: "relic-aegis", name: "Reach", description: "", value: 0.12, aspect: "reach" };
    const missed = resolveBattle(
      { id: "a", name: "A", attacks: [fire], defense: { ...hide, hp: 40 } },
      { id: "b", name: "B", attacks: [fire], defense: { ...hide, specials: [reach] } },
      1,
    );
    const caught = resolveBattle(
      { id: "a", name: "A", attacks: [bite], defense: { ...hide, hp: 40 } },
      { id: "b", name: "B", attacks: [bite], defense: { ...hide, specials: [reach] } },
      1,
    );
    assert.notEqual(missed.log.find((e) => e.actorId === "a")?.aside, "The relic meets that blow.");
    assert.equal(caught.log.find((e) => e.actorId === "a")?.aside, "The relic meets that blow.");
  });

  it("keeps a rooted body from closing, a guard for one blow, and a temper on the hide", () => {
    const hide: DefenseProfile = {
      hp: 160,
      armor: 0,
      knockbackResist: 0.3,
      elementalResist: {},
      specials: [],
      massClass: "medium",
      notes: [],
      footing: "mobile",
    };
    const bite: Attack = {
      id: "bite", template: "fang_bite", name: "Bite", type: "melee", element: "beast",
      basePower: 40, power: 40, range: 1.2, cooldown: 2, animationKey: "jaw_snap", effectStyle: "bite", description: "", flags: [],
    };
    const breath: Attack = {
      id: "breath", template: "breath_stream", name: "Stream", type: "breath", element: "beast",
      basePower: 18, power: 18, range: 7, cooldown: 3, animationKey: "breath_stream", effectStyle: "stream", description: "", flags: [],
    };
    const rooted = resolveBattle(
      { id: "a", name: "A", attacks: [bite, breath], defense: { ...hide, hp: 40, footing: "rooted" } },
      { id: "b", name: "B", attacks: [bite], defense: hide },
      1,
    );
    assert.equal(rooted.log.find((e) => e.actorId === "a")?.attackId, "breath");
    const open = resolveBattle(
      { id: "a", name: "A", attacks: [bite], defense: { ...hide, hp: 30 } },
      { id: "b", name: "B", attacks: [bite], defense: hide },
      1,
    );
    const braced = resolveBattle(
      { id: "a", name: "A", attacks: [bite], defense: { ...hide, hp: 30 } },
      { id: "b", name: "B", attacks: [bite], defense: { ...hide, brace: 0.1 } },
      1,
    );
    const plain = open.log.find((e) => e.actorId === "a")!;
    const held = braced.log.find((e) => e.actorId === "a")!;
    assert.ok(held.damage < plain.damage);
    assert.equal(held.aside, "It sets against the blow.");
    const twice: Attack = { ...bite, hits: 2, power: 10, basePower: 10 };
    const pair = resolveBattle(
      { id: "a", name: "A", attacks: [twice], defense: { ...hide, hp: 20 } },
      { id: "b", name: "B", attacks: [twice], defense: hide },
      1,
    );
    assert.equal(pair.log.find((e) => e.actorId === "a")?.hits, 2);
    const temper = generateDefense(ph({ element: "fire", sizeM: 1.2, covering: { type: "skin" } }));
    assert.ok(temper.specials.some((s) => s.id === "temper"));
  });

  it("lets a short blow fall short until someone steps in, and a guard take the next one", () => {
    const hide: DefenseProfile = {
      hp: 80,
      armor: 0,
      knockbackResist: 0.2,
      elementalResist: {},
      specials: [],
      massClass: "medium",
      notes: [],
      footing: "mobile",
    };
    const bite: Attack = {
      id: "bite", template: "fang_bite", name: "Bite", type: "melee", element: "beast",
      basePower: 20, power: 20, range: 1.2, cooldown: 1, animationKey: "jaw_snap", effectStyle: "bite", description: "", flags: [],
    };
    const breath: Attack = {
      id: "breath", template: "breath_stream", name: "Stream", type: "breath", element: "fire",
      basePower: 16, power: 16, range: 7, cooldown: 2, animationKey: "breath_stream", effectStyle: "stream", description: "", flags: [], fxMotion: "stream",
    };
    const bout = startBout(
      { id: "a", name: "A", attacks: [bite, breath], defense: { ...hide, hp: 40 } },
      { id: "b", name: "B", attacks: [bite], defense: hide },
      "volcanic",
    );
    openRound(bout);
    const menu = offers(bout);
    const short = menu.attacks.find((a) => a.name === "Bite")!;
    const far = menu.attacks.find((a) => a.name === "Stream")!;
    assert.equal(short.reaches, false);
    assert.equal(far.reaches, true);
    const missed = commit(bout, { kind: "attack", index: short.index });
    assert.equal(missed.at(-1)?.damage, 0);
    assert.match(missed.at(-1)?.text ?? "", /falls short/);
    openRound(bout);
    commit(bout, { kind: "close" });
    openRound(bout);
    commit(bout, { kind: "close" });
    assert.ok(bout.distance <= 1.6);
    openRound(bout);
    const guarded = commit(bout, { kind: "guard" });
    assert.match(guarded.at(-1)?.text ?? "", /guards/);
    openRound(bout);
    const into = commit(bout, { kind: "attack", index: 0 });
    const landed = into.filter((e) => e.damage > 0);
    assert.ok(landed.length >= 1);
    assert.match(landed[0]?.text ?? "", /guard takes it/);
  });
});

describe("the field", () => {
  it("holds hundreds of distinct attacks, wards, and motions", () => {
    assert.ok(ATTACK_LEXICON.length >= 2000);
    assert.ok(WARD_LEXICON.length >= 500);
    assert.equal(new Set(ATTACK_LEXICON.map((t) => t.id)).size, ATTACK_LEXICON.length);
    assert.equal(new Set(ATTACK_LEXICON.map((t) => t.name)).size, ATTACK_LEXICON.length);
    assert.equal(new Set(WARD_LEXICON.map((w) => w.id)).size, WARD_LEXICON.length);
    assert.equal(new Set(WARD_LEXICON.map((w) => w.name)).size, WARD_LEXICON.length);
    assert.ok(new Set(ATTACK_LEXICON.map((t) => t.motion)).size >= 18);
    for (const tech of ATTACK_LEXICON) {
      const hits = tech.hits ?? 1;
      const aoe = tech.aoeRadius ? 1 + Math.min(0.25, tech.aoeRadius * 0.05) : 1;
      const dot = tech.type === "dot" ? tech.basePower * 0.28 * 2 : 0;
      const threat = (tech.basePower * hits * aoe + dot) / tech.cooldown;
      assert.ok(threat >= 5 && threat <= 16, `${tech.id} threat ${threat}`);
    }
  });

  it("keeps same-sized bouts contestable and gives size an edge that is not a lock", () => {
    const elements = ["plant", "fire", "water", "earth", "ice", "electric", "plasma", "air", "metal", "light", "void", "beast"];
    const coverings = ["skin", "fur", "scale", "chitin", "plate", "shell", "bark", "slime"];
    let seed = 20261025;
    const rnd = () => {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const roll = (band: "light" | "heavy") => {
      for (let n = 0; n < 12; n++) {
        const element = elements[Math.floor(rnd() * elements.length)]!;
        const second = rnd() < 0.25 ? elements[Math.floor(rnd() * elements.length)] : undefined;
        const sizeM = band === "light" ? 0.45 + rnd() * 0.4 : 2.55 + rnd() * 1.1;
        const build = band === "light" ? (["lithe", "wraith", "dancer"] as const)[Math.floor(rnd() * 3)]! : (["titan", "colossus", "guardian"] as const)[Math.floor(rnd() * 3)]!;
        const units = [];
        if (rnd() < 0.55) units.push({ unit: "horn", count: 1 + Math.floor(rnd() * 3) });
        if (rnd() < 0.4) units.push({ unit: "wing", count: 2 });
        if (rnd() < 0.35) units.push({ unit: "tentacle", count: 2 + Math.floor(rnd() * 4) });
        if (rnd() < 0.45) units.push({ unit: "tail", count: 1 });
        if (rnd() < 0.3) units.push({ unit: "spine", count: 2 });
        const body = ph({
          element,
          element2: second && second !== element ? second : undefined,
          sizeM,
          build,
          covering: { type: coverings[Math.floor(rnd() * coverings.length)]! },
          units,
          claws: rnd() < 0.35 ? "talon" : undefined,
          loco: rnd() < 0.3 ? "Swim" : undefined,
        });
        const cls = massClassOf(massFactorOf(body.sizeM, body.build));
        if (cls === band) return body;
      }
      return ph({
        element: "beast",
        sizeM: band === "light" ? 0.6 : 3,
        build: band === "light" ? "lithe" : "colossus",
        covering: { type: "skin" },
      });
    };
    const fight = (aPh: ReturnType<typeof ph>, bPh: ReturnType<typeof ph>) =>
      resolveBattle(
        { id: "a", name: "A", attacks: generateAttacks(aPh), defense: generateDefense(aPh) },
        { id: "b", name: "B", attacks: generateAttacks(bPh), defense: generateDefense(bPh) },
      );
    let peerWins = 0;
    const peers = 24;
    for (let i = 0; i < peers; i++) {
      const left = roll("light");
      const right = roll("light");
      const result = fight(left, right);
      if (result.winnerId === "a" || result.winnerId === "b") peerWins += 1;
      else peerWins += 0.5;
    }
    assert.ok(peerWins >= 8, `peer fights resolved ${peerWins}`);
    let heavyWins = 0;
    let lightShare = 0;
    const crosses = 24;
    for (let i = 0; i < crosses; i++) {
      const heavy = roll("heavy");
      const light = roll("light");
      const heavyHp = generateDefense(heavy).hp;
      const result = fight(heavy, light);
      if (result.winnerId === "a") heavyWins += 1;
      lightShare += 1 - result.leftHp / heavyHp;
    }
    assert.ok(heavyWins >= 16 && heavyWins <= 23, `heavy won ${heavyWins} of ${crosses}`);
    assert.ok(lightShare / crosses >= 0.5, `lighter bodies dealt ${lightShare / crosses}`);
  });
});

describe("every body", () => {
  it("uses the lab ages, not invented ones", () => {
    assert.deepEqual(
      [...LIFE_STAGES],
      ["Sprout", "Keen", "Adept", "Apex", "Steward", "Artisan", "Exemplar", "Sovereign"],
    );
  });
  const blank = (): Companion => ({
    id: "a",
    name: "A",
    stage: "Apex",
    element: "beast",
    sizeM: 1.4,
    maxHp: 80,
    hp: 80,
    horns: false,
    wings: false,
    tail: false,
    legs: 0,
    claws: false,
    fins: false,
    tentacles: false,
    shell: false,
    covering: "skin",
    loco: "",
    ecology: "",
    armor: 0.1,
    plan: "",
    organ: "",
    volant: false,
    spines: false,
    mandibles: false,
    gait: "crawl",
  });

  function grown(over: Partial<Companion>): Companion {
    const c = { ...blank(), ...over };
    c.gait = gaitOf(c);
    return c;
  }

  const plans: Array<[string, Partial<Companion>, Companion["gait"]]> = [
    ["biped", { plan: "biped" }, "stride"],
    ["quadruped", { plan: "quadruped" }, "gallop"],
    ["centauroid", { plan: "centauroid" }, "gallop"],
    ["hexapod", { plan: "hexapod" }, "scuttle"],
    ["octopod", { plan: "octopod" }, "scuttle"],
    ["aquatic stand", { plan: "aquatic_stand" }, "stride"],
    ["serpent", { plan: "serpentine" }, "slither"],
    ["worm", { plan: "worm" }, "crawl"],
    ["segmented serpent", { plan: "segmented_serpent" }, "slither"],
    ["radial", { plan: "radial" }, "radial"],
    ["sessile radial", { plan: "sessile_radial" }, "rooted"],
    ["blob", { plan: "blob" }, "ooze"],
    ["amorphous", { plan: "amorphous" }, "ooze"],
    ["sessile mass", { plan: "sessile_mass" }, "rooted"],
    ["floater", { plan: "floater" }, "hover"],
    ["swimmer", { plan: "swimmer", fins: true }, "swim"],
  ];

  const locos: Array<[string, Partial<Companion>, Companion["gait"]]> = [
    ["BipedWalk", { loco: "BipedWalk" }, "stride"],
    ["Crawl", { loco: "Crawl" }, "crawl"],
    ["Hover", { loco: "Hover" }, "hover"],
    ["Hover with wings", { loco: "Hover", wings: true }, "fly"],
    ["MultiLegRipple", { loco: "MultiLegRipple" }, "scuttle"],
    ["QuadGait", { loco: "QuadGait" }, "gallop"],
    ["Sessile", { loco: "Sessile" }, "rooted"],
    ["Slither", { loco: "Slither" }, "slither"],
    ["Swim", { loco: "Swim" }, "swim"],
  ];

  it("gives every plan and every gait its own way of moving", () => {
    const seen = new Set<string>();
    for (const [label, over, gait] of [...plans, ...locos]) {
      const c = grown(over);
      assert.equal(c.gait, gait, label);
      seen.add(c.gait);
    }
    assert.equal(seen.size, 11);
  });

  it("keeps a rooted body on its ground and still lets every other body commit", () => {
    const covers = [
      { x: 0.36, y: 0.46, r: 0.06, kind: "stone" as const },
      { x: 0.64, y: 0.56, r: 0.07, kind: "tree" as const },
      { x: 0.5, y: 0.62, r: 0.12, kind: "pool" as const },
    ];
    for (const [, over] of plans) {
      const a = grown({ ...over, name: "Left", id: "a" });
      const d = grown({ plan: "biped", name: "Right", id: "b" });
      const line = chooseLine(a, d, "bite", "jaw_snap", covers, 0.2, 0.6, 0.8, 0.6);
      assert.ok(line.note.includes("Left"), a.plan || a.loco);
      assert.ok(line.ax >= 0 && line.ax <= 1 && line.dx >= 0 && line.dx <= 1);
      if (a.gait === "rooted") assert.equal(line.ax, 0.2);
      if (a.gait === "swim") assert.ok(Math.abs(line.ay - 0.62) < 0.02, "a swimmer uses the water");
    }
  });
});

describe("hit and act", () => {
  it("meets on the facing axis and stays thin from the side", () => {
    const long = hullOf([-0.2, 0, -1], [0.2, 0.6, 1]);
    assert.ok(Math.abs(long.along - 1) < 1e-6);
    assert.ok(Math.abs(long.across - 0.2) < 1e-6);
    const nose = supportRadius(long, Math.PI / 2, 1, 0);
    const shoulder = supportRadius(long, Math.PI / 2, 0, 1);
    assert.ok(nose > shoulder * 2);
    const headOn = touchDistance(long, Math.PI / 2, 0, 0, long, -Math.PI / 2, 5, 0, 0);
    const beside = touchDistance(long, 0, 0, 0, long, 0, 2, 0, 0);
    assert.ok(Math.abs(headOn - 2) < 0.05);
    assert.ok(beside < 0.5);
    assert.ok(headOn > beside * 3);
  });

  it("gives every motion a pose of its own", () => {
    const owned = ["yawn", "wing_stretch", "display", "sway", "pounce", "glow_pulse", "tentacle_explore", "shake_off", "rear"];
    const first = new Map<string, string>();
    for (const motion of MOTIONS) {
      const acts = actsForAttack("act", motion, owned);
      const playable = acts.filter((id) => owned.includes(id));
      assert.ok(playable.length > 2, motion);
      first.set(motion, playable[0]!);
    }
    assert.notEqual(first.get("bite"), first.get("wing"));
    assert.notEqual(first.get("stream"), first.get("slam"));
    assert.notEqual(first.get("charge"), first.get("rain"));
    assert.notEqual(first.get("lash"), first.get("bite"));
  });

  it("lets lab stats edge a body without changing an unmeasured one", () => {
    const plain = ph({ element: "beast", sizeM: 1.4, units: [{ unit: "horn", count: 2 }] });
    const measured = ph({ element: "beast", sizeM: 1.4, units: [{ unit: "horn", count: 2 }], stats: { power: 1.24, guard: 1.2, vigor: 1.18, swift: 1.22, focus: 1.16, spirit: 1.1 } });
    const a = generateAttacks(plain);
    const da = generateDefense(plain);
    const db = generateDefense(measured);
    assert.ok(db.hp >= da.hp);
    assert.ok(db.armor >= da.armor);
    assert.equal(da.edge, undefined);
    assert.ok((db.edge ?? 1) > 1);
    assert.equal(da.initiative, undefined);
    assert.ok((db.initiative ?? 0) > 1);
    const kit = { id: "a", name: "A", attacks: a, defense: { ...da, hp: 80 } };
    const keen = { id: "b", name: "B", attacks: a, defense: { ...da, hp: 80, initiative: 1.2 } };
    const result = resolveBattle(kit, { ...keen, defense: { ...keen.defense, initiative: 1.2 } }, 1);
    assert.equal(result.log.find((e) => e.attackId !== "dot" && e.attackId !== "knit")?.actorId, "b");
    const blunt = resolveBattle(
      { id: "a", name: "A", attacks: a, defense: { ...da, hp: 400 } },
      { id: "b", name: "B", attacks: a, defense: { ...da, hp: 400 } },
      1,
    );
    const sharp = resolveBattle(
      { id: "a", name: "A", attacks: a, defense: { ...da, hp: 400, edge: db.edge } },
      { id: "b", name: "B", attacks: a, defense: { ...da, hp: 400 } },
      1,
    );
    const bluntHit = blunt.log.find((e) => e.actorId === "a" && e.attackId !== "knit");
    const sharpHit = sharp.log.find((e) => e.actorId === "a" && e.attackId !== "knit");
    assert.ok(bluntHit && sharpHit && sharpHit.damage > bluntHit.damage);
  });
});
