/** Lookup tables for mass, hide, and elemental temperament. */

export const BUILD_MASS: Record<string, number> = {
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
  colossus: 1.6,
};

export const COVERING_ARMOR: Record<string, number> = {
  skin: 0.04,
  fur: 0.09,
  feather: 0.05,
  scale: 0.22,
  chitin: 0.34,
  bark: 0.26,
  slime: 0.05,
  shell: 0.5,
  plate: 0.42,
};

/**
 * Innate resist granted by bearing an element.
 * Positive resists that element; negative is a weakness.
 */
export const ELEMENT_RESIST: Record<string, Record<string, number>> = {
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
  beast: { beast: 0.2, plant: 0.05, metal: -0.12 },
};

const LARGE_BUILDS = new Set(["titan", "colossus", "guardian", "brawler", "heavy"]);

export function isLargeBuild(build: string | undefined, sizeM: number): boolean {
  return LARGE_BUILDS.has(build ?? "") || sizeM >= 2.6;
}
