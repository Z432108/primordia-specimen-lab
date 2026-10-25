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

  // primordia-specimen-lab/combat/animate.ts
  var KNOWN = new Set(ANIMATION_KEYS);
  var ACT_FOR = {
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
    act: ["display", "look_around"]
  };
  function resolveAnimation(key) {
    if (KNOWN.has(key)) return { key, fallback: false };
    console.info("combat: missing animation driver", key);
    return { key: "act", fallback: true };
  }
  function playAttack(anim, animationKey, mass) {
    const resolved = resolveAnimation(animationKey);
    const tries = ACT_FOR[resolved.key] ?? ACT_FOR.act;
    if (!anim) {
      console.info("combat: missing animation driver", animationKey);
      return { key: "act", fallback: true, act: null };
    }
    const rate = mass === "heavy" ? 0.55 : mass === "light" ? 1.2 : 0.85;
    if (anim.acts) anim.acts.rate = rate;
    else anim.setActs?.({ rate });
    let act = null;
    for (const id of tries) {
      try {
        if (anim.act?.(id)) {
          act = id;
          break;
        }
      } catch {
      }
    }
    if (!act) {
      console.info("combat: missing animation driver", animationKey);
      try {
        if (anim.act?.("look_around")) act = "look_around";
      } catch {
      }
      return { key: "act", fallback: true, act };
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
      if (sys === "dorsal" && fam && /spine|quill|spike/.test(fam)) unit = "spine";
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
      stats
    };
  }

  // primordia-specimen-lab/combat/battle.ts
  function strikeDamage(attack, defense) {
    const resist = defense.elementalResist[attack.element] ?? 0;
    const hits = attack.hits ?? 1;
    let raw = attack.power * hits * (1 - defense.armor) * (1 - resist);
    if (attack.aoeRadius) raw *= 1 + Math.min(0.25, attack.aoeRadius * 0.05);
    return Math.max(1, Math.round(raw));
  }
  function pick(side) {
    let best = -1;
    let score = -1;
    side.fighter.attacks.forEach((attack, i) => {
      if ((side.cd[i] ?? 0) > 0) return;
      const s = attack.power + (attack.flags.includes("priority") ? 6 : 0);
      if (s > score) {
        score = s;
        best = i;
      }
    });
    return best;
  }
  function resolveBattle(a, b, maxTurns = 16) {
    const sides = [
      { fighter: a, hp: a.defense.hp, cd: a.attacks.map(() => 0), dots: [] },
      { fighter: b, hp: b.defense.hp, cd: b.attacks.map(() => 0), dots: [] }
    ];
    const log = [];
    let actor = 0;
    let turn = 1;
    const alive = () => sides[0].hp > 0 && sides[1].hp > 0;
    while (turn <= maxTurns && alive()) {
      const self = sides[actor];
      const foe = sides[1 - actor];
      let dotSum = 0;
      const dotNames = [];
      self.dots = self.dots.filter((dot) => {
        if (dot.left <= 0) return false;
        dotSum += dot.damage;
        dot.left -= 1;
        dotNames.push(dot.name);
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
          text: `${self.fighter.name} takes ${dotSum} from ${dotNames.join(", ")}.`
        });
        if (self.hp <= 0) break;
      }
      self.cd = self.cd.map((c) => Math.max(0, c - 1));
      const index = pick(self);
      if (index < 0) {
        actor = 1 - actor;
        if (actor === 0) turn += 1;
        continue;
      }
      const attack = self.fighter.attacks[index];
      const damage = strikeDamage(attack, foe.fighter.defense);
      foe.hp = Math.max(0, foe.hp - damage);
      self.cd[index] = attack.cooldown;
      if (attack.type === "dot") {
        foe.dots.push({
          damage: Math.max(1, Math.round(attack.power * 0.28)),
          left: 2,
          name: attack.name
        });
      }
      const hold = foe.fighter.defense.knockbackResist >= 0.45;
      const ko = foe.hp <= 0;
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
        text: ko ? `${self.fighter.name} uses ${attack.name} for ${damage}. ${foe.fighter.name} falls.` : `${self.fighter.name} uses ${attack.name} for ${damage}. ${foe.fighter.name} ${hold ? "holds" : "gives ground"} (${foe.hp} left).`
      });
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
  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }
  function round2(n) {
    return Math.round(n * 100) / 100;
  }
  function title(s) {
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
    const adj = ADJ[element] ?? title(element);
    const noun = NOUN[template] ?? title(template);
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
      case "claw_arc":
        return `The ${ph.claws?.replaceAll("_", " ") ?? "claws"} cut a ${el2} arc.`;
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
        return `${title(ph.element)} and ${title(ph.element2 ?? el2)} leave the body together.`;
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
    if (countUnits(ph, "mandible") > 0 || hasFeature(ph, /mandible/)) {
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
    } else if (hasFeature(ph, /fang|carnass|serrat|needle/)) {
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
        name: `${ADJ[element] ?? title(element)}\u2013${ADJ[ph.element2] ?? title(ph.element2)} Twin`
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
        name: ORGAN_NAME[organ] ?? `${title(organ)} Pulse`,
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
        name: `${title(relic.kind)} \xB7 ${relic.use}`,
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
    const powerMul = statMul(ph.stats?.power);
    const attacks = kept.map((d, i) => {
      const power = Math.max(1, Math.round(d.basePower * factor * powerMul));
      return {
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
        flags: d.flags
      };
    });
    attacks.sort((a, b) => {
      const ap = a.power + (a.flags.includes("priority") ? 6 : 0);
      const bp = b.power + (b.flags.includes("priority") ? 6 : 0);
      return bp - ap || a.template.localeCompare(b.template);
    });
    return attacks;
  }
  function addResist(map, element, amount) {
    map[element] = round2(clamp((map[element] ?? 0) + amount, -0.6, 0.75));
  }
  function generateDefense(ph) {
    const covering = ph.covering?.type ?? "skin";
    const factor = massFactorOf(ph.sizeM, ph.build);
    const massClass = massClassOf(factor);
    let armor = COVERING_ARMOR[covering] ?? 0.04;
    const sculpture = ph.shell?.sculpture ?? [];
    if (sculpture.includes("spines") || sculpture.includes("knobs")) armor += 0.04;
    if (ph.shell && covering !== "shell" && covering !== "plate") armor += 0.06;
    armor = round2(clamp(armor, 0, 0.82));
    const wings = countUnits(ph, "wing", "wings");
    let knockback = 0.12 + Math.min(0.55, factor * 0.14) + armor * 0.28;
    if (massClass === "light" && wings > 0) knockback *= 0.72;
    const knockbackResist = round2(clamp(knockback, 0.05, 0.94));
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
    const vigor = statMul(ph.stats?.vigor);
    const hp = Math.max(12, Math.round(64 * factor * (0.75 + 0.4 * vigor) * (1 + armor * 0.55)));
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
        value: ph.ascent.relic.held ? 0.12 : 0.06
      });
    }
    if ((covering === "bark" || ph.element === "plant") && (ph.stats?.vigor ?? 1) >= 1) {
      specials.push({
        id: "sap-knit",
        name: "Sap knit",
        description: "Living tissue closes slowly over a shallow wound.",
        value: round2(0.05)
      });
    }
    const weak = Object.entries(elementalResist).filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1])[0];
    const notes = [
      `${title(massClass)} body, ${ph.sizeM.toFixed(2)} m, build ${ph.build ?? "medium"}.`,
      `${title(covering)} hide stops about ${Math.round(armor * 100)}% of a blow.`
    ];
    if (weak) notes.push(`${title(weak[0])} bites harder than the rest.`);
    if (ph.element2) notes.push(`A second element, ${ph.element2}, shares the ward.`);
    return { hp, armor, knockbackResist, elementalResist, specials, massClass, notes };
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
  function currentRecord() {
    const ctx = lab();
    if (!ctx?.state?.ph) return null;
    const ph = toCombatPhenotype(ctx.state.ph, { build: ctx.state.build });
    const id = ctx.state.genome?.id ?? "current";
    const stage = ctx.state.stage ?? "";
    const rec = {
      id: `${id}@${stage}`,
      name: specimenName(),
      stage,
      attacks: generateAttacks(ph),
      defense: generateDefense(ph)
    };
    memory.set(rec.id, rec);
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
      ...defense.specials.map((s) => el("li", {}, el("code", {}, s.name), text(` ${s.description}`)))
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
        el("dd", { class: "mono" }, pct(defense.knockbackResist))
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
        el("span", { class: "chip" }, attack.animationKey)
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
  function battleBlock(self) {
    const others = [...memory.values()].filter((r) => r.id !== self.id);
    const select = el("select", { id: "combat-foe", "aria-label": "Opponent" });
    if (!others.length) {
      const opt = el("option", { value: "" }, "Open another specimen first");
      select.append(opt);
      select.disabled = true;
    } else {
      for (const foe of others) {
        select.append(el("option", { value: foe.id }, `${foe.name}${foe.stage ? ` \xB7 ${foe.stage}` : ""}`));
      }
    }
    const go = el("button", { class: "btn primary small", type: "button", "data-k": "combat-battle" }, "Battle");
    if (!others.length) go.setAttribute("disabled", "");
    const logHost = el("div", { id: "combat-log" });
    go.addEventListener("click", () => {
      const foe = memory.get(select.value);
      if (!foe) return;
      const left = { id: self.id, name: self.name, attacks: self.attacks, defense: self.defense };
      const right = { id: foe.id, name: foe.name, attacks: foe.attacks, defense: foe.defense };
      const result = resolveBattle(left, right);
      paintLog(logHost, result, self, foe);
      const ctx = lab();
      const first = result.log.find((e) => e.actorId === self.id && e.attackId !== "dot");
      if (first && ctx) playAttack(ctx.anim, first.animationKey, self.defense.massClass);
    });
    return el(
      "section",
      { class: "sec" },
      el("h2", {}, "Battle"),
      el("p", {}, "The current specimen against one already opened. Same bodies, same result."),
      el("div", { class: "row" }, select, go),
      logHost
    );
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
    host.append(
      el(
        "section",
        { class: "sec" },
        el("h2", {}, "Field of arms"),
        el("p", {}, "Attacks and the ward are read from the body. The same specimen always keeps the same kit."),
        el("p", { class: "mono muted" }, `Kit ${sig} \xB7 ${rec.attacks.length} attacks`),
        el("div", { class: "row" }, copy)
      ),
      defenseBlock(rec.defense),
      el(
        "section",
        { class: "sec" },
        el("h2", {}, "Attacks"),
        ...rec.attacks.map(
          (attack) => attackBlock(attack, () => {
            const played = playAttack(ctx?.anim, attack.animationKey, rec.defense.massClass);
            if (played.fallback) ctx?.toast?.(`No driver for ${attack.animationKey}. A generic act plays.`);
          })
        )
      ),
      battleBlock(rec)
    );
  }
  function installStyle() {
    if (document.getElementById("primordia-combat-style")) return;
    const style = document.createElement("style");
    style.id = "primordia-combat-style";
    style.textContent = `
    .combat-atk { display: grid; gap: 6px; padding: 12px 0; border-top: 1px solid var(--line); }
    .combat-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .combat-name { margin: 0; font-family: var(--f-display); font-weight: 700; font-size: var(--step-1); }
    .combat-stats { margin-top: 2px; }
    .chip.resist { font-family: var(--f-mono); font-size: 0.68rem; letter-spacing: 0.04em; text-transform: uppercase; padding: 2px 7px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); }
    .chip.resist.weak { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 55%, var(--line)); }
    #combat-foe { min-height: 36px; border-radius: 10px; border: 1px solid var(--line); background: var(--panel-2); color: var(--text); padding: 6px 10px; font: inherit; }
    .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  `;
    document.head.append(style);
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
})();
