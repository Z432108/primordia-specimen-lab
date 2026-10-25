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
}

export interface BattleResult {
  log: BattleEvent[];
  winnerId: string | null;
  leftHp: number;
  rightHp: number;
  rounds: number;
}

export function strikeDamage(attack: Attack, defense: DefenseProfile): number {
  const resist = defense.elementalResist[attack.element] ?? 0;
  const hits = attack.hits ?? 1;
  let raw = attack.power * hits * (1 - defense.armor) * (1 - resist);
  if (attack.aoeRadius) raw *= 1 + Math.min(0.25, attack.aoeRadius * 0.05);
  return Math.max(1, Math.round(raw));
}

interface Dot {
  damage: number;
  left: number;
  name: string;
}

interface Side {
  fighter: BattleFighter;
  hp: number;
  cd: number[];
  dots: Dot[];
}

function pick(side: Side): number {
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

/**
 * One attack per side per turn. Armor, elemental resist, and lingering venom apply.
 * Deterministic: the same two kits always write the same log.
 */
export function resolveBattle(a: BattleFighter, b: BattleFighter, maxTurns = 16): BattleResult {
  const sides: [Side, Side] = [
    { fighter: a, hp: a.defense.hp, cd: a.attacks.map(() => 0), dots: [] },
    { fighter: b, hp: b.defense.hp, cd: b.attacks.map(() => 0), dots: [] },
  ];
  const log: BattleEvent[] = [];
  let actor = 0;
  let turn = 1;

  const alive = () => sides[0].hp > 0 && sides[1].hp > 0;

  while (turn <= maxTurns && alive()) {
    const self = sides[actor]!;
    const foe = sides[1 - actor]!;
    let dotSum = 0;
    const dotNames: string[] = [];
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
        text: `${self.fighter.name} takes ${dotSum} from ${dotNames.join(", ")}.`,
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
    const attack = self.fighter.attacks[index]!;
    const damage = strikeDamage(attack, foe.fighter.defense);
    foe.hp = Math.max(0, foe.hp - damage);
    self.cd[index] = attack.cooldown;
    if (attack.type === "dot") {
      foe.dots.push({
        damage: Math.max(1, Math.round(attack.power * 0.28)),
        left: 2,
        name: attack.name,
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
      text: ko
        ? `${self.fighter.name} uses ${attack.name} for ${damage}. ${foe.fighter.name} falls.`
        : `${self.fighter.name} uses ${attack.name} for ${damage}. ${foe.fighter.name} ${hold ? "holds" : "gives ground"} (${foe.hp} left).`,
    });
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
