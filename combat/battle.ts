import type { Attack, DefenseProfile } from "./types.ts";

export interface BattleFighter {
  id: string;
  name: string;
  attacks: Attack[];
  defense: DefenseProfile;
}

export interface BattleEvent {
  turn: number;
  actorId: string;
  actorName: string;
  attackName: string;
  attackId: string;
  animationKey: string;
  damage: number;
  hpAfter: number;
  targetName: string;
  ko: boolean;
  text: string;
  element?: string;
  fxMotion?: string;
  fxSeed?: number;
  /** A short clause when a rule of the body changed the blow. */
  aside?: string;
  hits?: number;
}

export interface BattleResult {
  log: BattleEvent[];
  winnerId: string | null;
  leftHp: number;
  rightHp: number;
  rounds: number;
}

export function armorCut(material: number): number {
  const a = Math.max(0, material);
  return (a / (a + 0.85)) * 0.46;
}

/** One moment may not spend more than this share of a body. */
export function blowCap(maxHp: number): number {
  return Math.max(6, Math.round(Math.max(1, maxHp) * 0.3));
}

/** A larger body hits harder, but not in proportion to how much harder it is to kill. */
function massLean(attackerHp: number, defenderHp: number): number {
  const ratio = Math.max(0.45, attackerHp / Math.max(1, defenderHp));
  return 1 / Math.pow(ratio, 0.72);
}

export function expectedThreat(attack: Pick<Attack, "power" | "hits" | "aoeRadius" | "cooldown" | "type" | "flags">): number {
  const hits = attack.hits ?? 1;
  const aoe = attack.aoeRadius ? 1 + Math.min(0.25, attack.aoeRadius * 0.05) : 1;
  const echo = attack.flags.includes("echo") ? attack.power * 0.12 : 0;
  const dot = attack.type === "dot" ? attack.power * 0.28 * 2 : 0;
  return (attack.power * hits * aoe + echo + dot) / Math.max(1, attack.cooldown);
}

function resistOf(attack: Attack, defense: DefenseProfile): number {
  let resist = defense.elementalResist[attack.element] ?? 0;
  if (attack.flags.includes("dual") && attack.element2) {
    resist = (resist + (defense.elementalResist[attack.element2] ?? 0)) / 2;
  }
  if (attack.type === "special") resist *= 0.75;
  return Math.max(-0.34, Math.min(0.4, resist));
}

/** How this kind of blow meets a hide. Kept small, so a variation is not a verdict. */
function profile(attack: Attack): { armor: number; power: number } {
  let armor = attack.type === "breath" || attack.type === "projectile" ? 0.86 : 1;
  let power = 1;
  const motion = attack.fxMotion;
  if (motion === "bite" || motion === "grind") armor += 0.06;
  else if (motion === "lash" || motion === "volley" || motion === "rain" || motion === "sting") armor -= 0.04;
  else if (motion === "stream" || motion === "spiral" || motion === "sigil") armor -= 0.03;
  else if (motion === "charge" || motion === "thrust" || motion === "slam") power += 0.04;
  else if (motion === "cone" || motion === "burst" || motion === "wing") power += 0.03;
  else if (motion === "yank" || motion === "brume" || motion === "wall") power -= 0.05;
  if (attack.flags.includes("venom") && attack.type !== "dot") power -= 0.04;
  return {
    armor: Math.max(0.82, Math.min(1.08, armor)),
    power: Math.max(0.9, Math.min(1.08, power)),
  };
}

export function strikeDamage(attack: Attack, defense: DefenseProfile): number {
  const resist = resistOf(attack, defense);
  const hits = attack.hits ?? 1;
  const shaped = profile(attack);
  const armor = defense.armor * shaped.armor;
  let raw = attack.power * hits * shaped.power * (1 - armor) * (1 - resist);
  if (attack.aoeRadius) raw *= 1 + Math.min(0.25, attack.aoeRadius * 0.05);
  const grounded = (attack.type === "slam" || attack.animationKey === "body_charge") && !attack.flags.includes("aerial");
  if (defense.airborne && grounded) raw *= 0.9;
  else if (attack.flags.includes("aerial") && !defense.airborne) raw *= 1.06;
  return Math.max(1, Math.round(raw));
}

function relicMatches(aspect: string | undefined, attack: Attack): boolean {
  if (!aspect || aspect === "guard") return true;
  if (aspect === "smash" || aspect === "brawl") return attack.type === "melee" || attack.type === "slam";
  if (aspect === "reach") return attack.type === "melee" && attack.range <= 2.4;
  if (aspect === "gust" || aspect === "light") return attack.type === "breath" || attack.type === "projectile";
  if (aspect === "focus") return attack.type === "special" || attack.type === "breath";
  if (aspect === "steady") return attack.type === "slam" || attack.fxMotion === "charge" || attack.animationKey === "body_charge";
  return true;
}

interface Dot {
  damage: number;
  left: number;
  name: string;
  element: string;
}

interface Side {
  fighter: BattleFighter;
  hp: number;
  cd: number[];
  dots: Dot[];
  aegisUsed: boolean;
  braced: boolean;
}

/** Highest power, unless this body can read. Then it spends the blow the hide answers worst. */
function choose(side: Side, foe: Side): number {
  const read = (side.fighter.defense.focus ?? 1) >= 1.12;
  let best = -1;
  let score = -1;
  side.fighter.attacks.forEach((attack, i) => {
    if ((side.cd[i] ?? 0) > 0) return;
    const priority = attack.flags.includes("priority") ? 6 : 0;
    let s = (read ? strikeDamage(attack, foe.fighter.defense) : attack.power) + priority;
    const rooted = side.fighter.defense.footing === "rooted" && foe.fighter.defense.footing !== "rooted";
    const short = (attack.type === "melee" || attack.type === "slam") && attack.range < 3;
    if (rooted && short) s *= 0.4;
    if (s > score) {
      score = s;
      best = i;
    }
  });
  return best;
}

/**
 * One attack per side per turn. Armor, elemental resist, and lingering venom apply.
 * Deterministic: the same two kits always write the same log.
 */
export function resolveBattle(a: BattleFighter, b: BattleFighter, maxTurns = 16): BattleResult {
  const sides: [Side, Side] = [
    { fighter: a, hp: a.defense.hp, cd: a.attacks.map(() => 0), dots: [], aegisUsed: false, braced: false },
    { fighter: b, hp: b.defense.hp, cd: b.attacks.map(() => 0), dots: [], aegisUsed: false, braced: false },
  ];
  const log: BattleEvent[] = [];
  let actor = a.defense.hp < b.defense.hp ? 0 : b.defense.hp < a.defense.hp ? 1 : (a.defense.initiative ?? 1) >= (b.defense.initiative ?? 1) ? 0 : 1;
  let turn = 1;

  const alive = () => sides[0].hp > 0 && sides[1].hp > 0;

  while (turn <= maxTurns && alive()) {
    const self = sides[actor]!;
    const foe = sides[1 - actor]!;
    let dotSum = 0;
    const dotNames: string[] = [];
    let dotElement = "beast";
    self.dots = self.dots.filter((dot) => {
      if (dot.left <= 0) return false;
      dotSum += dot.damage;
      dot.left -= 1;
      dotNames.push(dot.name);
      dotElement = dot.element;
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
        element: dotElement,
        fxMotion: "brume",
        text: `${self.fighter.name} takes ${dotSum} from ${dotNames.join(", ")}.`,
      });
      if (self.hp <= 0) break;
    }

    const knit = self.fighter.defense.specials.find((s) => s.id === "sap-knit");
    if (knit && self.hp > 0 && self.hp < self.fighter.defense.hp) {
      const heal = Math.max(1, Math.round(self.fighter.defense.hp * Math.min(0.02, knit.value * 0.35)));
      const before = self.hp;
      self.hp = Math.min(self.fighter.defense.hp, self.hp + heal);
      if (self.hp > before) {
        log.push({
          turn,
          actorId: self.fighter.id,
          actorName: self.fighter.name,
          attackName: knit.name,
          attackId: "knit",
          animationKey: "act",
          damage: self.hp - before,
          hpAfter: self.hp,
          targetName: self.fighter.name,
          ko: false,
          element: "plant",
          fxMotion: "knit",
          text: `${self.fighter.name} knits ${self.hp - before} back (${self.hp} now).`,
        });
      }
    }

    self.cd = self.cd.map((c) => Math.max(0, c - 1));
    const index = choose(self, foe);
    if (index < 0) {
      actor = 1 - actor;
      if (actor === 0) turn += 1;
      continue;
    }
    const attack = self.fighter.attacks[index]!;
    const rawDamage = Math.max(1, Math.round(strikeDamage(attack, foe.fighter.defense) * (self.fighter.defense.edge ?? 1)));
    const leaned = Math.max(1, Math.round(rawDamage * massLean(self.fighter.defense.hp, foe.fighter.defense.hp)));
    const cap = blowCap(foe.fighter.defense.hp);
    let damage = Math.min(leaned, cap);
    const limited = damage < rawDamage;
    const aside: string[] = [];
    const ranged = attack.type === "breath" || attack.type === "projectile";
    if (ranged && foe.fighter.defense.armor >= 0.2) aside.push("It finds a seam.");
    if (attack.flags.includes("dual") && attack.element2) aside.push("Both elements arrive.");
    if (foe.fighter.defense.airborne && (attack.type === "slam" || attack.animationKey === "body_charge") && !attack.flags.includes("aerial")) {
      aside.push("It meets air.");
    }
    const planted = foe.fighter.defense.specials.find((s) => s.id === "immovable");
    if (planted && (attack.type === "slam" || attack.fxMotion === "charge" || attack.fxMotion === "thrust")) {
      damage = Math.max(1, Math.round(damage * 0.94));
      aside.push("It does not give the ground.");
    }
    const coat = foe.fighter.defense.specials.find((s) => s.id === "mucus");
    if (coat && attack.element === "water") {
      damage = Math.max(1, Math.round(damage * (1 - Math.min(0.14, coat.value))));
      aside.push("The coat shrugs it.");
    } else if (coat && attack.type === "melee") {
      const cling = Math.max(1, Math.min(Math.round(damage * 0.08), Math.round(self.fighter.defense.hp * 0.04)));
      self.dots.push({ damage: cling, left: 1, name: coat.name, element: attack.element });
      aside.push("It clings.");
    }
    const aegis = foe.fighter.defense.specials.find((s) => s.id === "relic-aegis");
    if (aegis && !foe.aegisUsed && relicMatches(aegis.aspect, attack)) {
      const cut = Math.max(1, Math.round(damage * Math.min(0.22, aegis.value + 0.08)));
      damage = Math.max(1, damage - cut);
      foe.aegisUsed = true;
      aside.push(aegis.aspect && aegis.aspect !== "guard" ? "The relic meets that blow." : "The relic answers.");
    }
    const ward = foe.fighter.defense.specials.find((s) => s.id === "ascent-ward");
    if (ward) {
      const cut = Math.round(damage * Math.min(0.08, ward.value * 0.4));
      if (cut > 0) {
        damage = Math.max(1, damage - cut);
        aside.push("The ascent holds.");
      }
    }
    const slip = foe.fighter.defense.specials.find((s) => s.id === "slip");
    if (slip && (attack.type === "melee" || attack.type === "slam") && !attack.flags.includes("aerial")) {
      const cut = Math.round(damage * Math.min(0.1, slip.value * 0.16));
      if (cut > 0) {
        damage = Math.max(1, damage - cut);
        aside.push("The wings shed it.");
      }
    }
    const cannotClose =
      self.fighter.defense.footing === "rooted" &&
      foe.fighter.defense.footing !== "rooted" &&
      (attack.type === "melee" || attack.type === "slam") &&
      attack.range < 3;
    if (cannotClose) {
      damage = Math.max(1, Math.round(damage * 0.72));
      aside.push("It cannot close.");
    }
    if (foe.fighter.defense.brace && !foe.braced) {
      const cut = Math.max(1, Math.round(damage * foe.fighter.defense.brace));
      damage = Math.max(1, damage - cut);
      foe.braced = true;
      aside.push("It sets against the blow.");
    }
    if ((attack.hits ?? 1) > 1) aside.push(`It lands ${attack.hits} times.`);
    foe.hp = Math.max(0, foe.hp - damage);
    self.cd[index] = Math.max(1, attack.cooldown - ((self.fighter.defense.focus ?? 1) >= 1.12 ? 1 : 0));
    if (attack.type === "dot" || attack.flags.includes("echo")) {
      const tick = attack.type === "dot" ? 0.28 : 0.12;
      const turns = attack.type === "dot" ? 2 : 1;
      foe.dots.push({
        damage: Math.max(1, Math.min(Math.round(attack.power * tick), Math.round(foe.fighter.defense.hp * 0.06))),
        left: turns,
        name: attack.name,
        element: attack.element,
      });
    }
    const thorn = foe.fighter.defense.specials.find((s) => s.id === "thorns");
    let reflected = 0;
    if (thorn && damage > 0) {
      reflected = Math.min(
        Math.round(damage * Math.min(0.1, thorn.value)),
        Math.round(self.fighter.defense.hp * 0.06),
      );
      if (reflected > 0) self.hp = Math.max(0, self.hp - reflected);
    }
    const hold = foe.fighter.defense.knockbackResist >= 0.45;
    const ko = foe.hp <= 0;
    const lead = aside.find((s) => s !== "It finds a seam.") ?? aside[0];
    const extra = `${lead ? ` ${lead}` : ""}${limited ? " A single moment will not spend the whole fight." : ""}${reflected ? ` Thorns return ${reflected}.` : ""}`;
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
      element: attack.element,
      fxMotion: attack.fxMotion,
      fxSeed: attack.fxSeed,
      aside: lead,
      hits: attack.hits,
      text: ko
        ? `${self.fighter.name} uses ${attack.name} for ${damage}. ${foe.fighter.name} falls.${extra}`
        : `${self.fighter.name} uses ${attack.name} for ${damage}. ${foe.fighter.name} ${hold ? "holds" : "gives ground"} (${foe.hp} left).${extra}`,
    });
    if (self.hp <= 0) break;
    actor = 1 - actor;
    if (actor === 0) turn += 1;
  }

  let winnerId: string | null = null;
  if (sides[0].hp <= 0 && sides[1].hp > 0) winnerId = b.id;
  else if (sides[1].hp <= 0 && sides[0].hp > 0) winnerId = a.id;
  else if (sides[0].hp !== sides[1].hp) winnerId = sides[0].hp > sides[1].hp ? a.id : b.id;

  return {
    log,
    winnerId,
    leftHp: sides[0].hp,
    rightHp: sides[1].hp,
    rounds: Math.max(1, turn - (actor === 0 ? 1 : 0)),
  };
}
