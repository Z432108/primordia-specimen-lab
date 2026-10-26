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
export { ATTACK_LEXICON, WARD_LEXICON, matchVariant, fieldHash } from "./catalogue.ts";
export {
  attachCombat,
  breathStyle,
  combatScale,
  countUnits,
  generateAttacks,
  generateDefense,
  kitSignature,
  massClassOf,
  massFactorOf,
  statMul,
  techniqueBorne,
} from "./generate.ts";
export { toCombatPhenotype } from "./adapter.ts";
export type { AdapterHints } from "./adapter.ts";
export { resolveBattle, strikeDamage, armorCut, blowCap, expectedThreat } from "./battle.ts";
export type { BattleEvent, BattleFighter, BattleResult } from "./battle.ts";
export { playAttack, resolveAnimation } from "./animate.ts";
