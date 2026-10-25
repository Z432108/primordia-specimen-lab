export type {
  Attack,
  AttackType,
  CombatPhenotype,
  CombatRelic,
  CombatUnit,
  DefenseProfile,
  DefenseSpecial,
  MassClass,
} from "./types.ts";
export { ANIMATION_KEYS } from "./types.ts";
export { BUILD_MASS, COVERING_ARMOR, ELEMENT_RESIST } from "./tables.ts";
export {
  attachCombat,
  breathStyle,
  countUnits,
  generateAttacks,
  generateDefense,
  kitSignature,
  massClassOf,
  massFactorOf,
  statMul,
} from "./generate.ts";
export { toCombatPhenotype } from "./adapter.ts";
export type { AdapterHints } from "./adapter.ts";
export { resolveBattle, strikeDamage } from "./battle.ts";
export type { BattleEvent, BattleFighter, BattleResult } from "./battle.ts";
export { playAttack, resolveAnimation } from "./animate.ts";
