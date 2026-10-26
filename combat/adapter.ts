import type { CombatPhenotype, CombatRelic, CombatUnit } from "./types.ts";

export interface AdapterHints {
  build?: unknown;
  stats?: Record<string, number>;
}

const SINGULAR: Record<string, string> = {
  horns: "horn",
  tentacles: "tentacle",
  wings: "wing",
  tails: "tail",
  fins: "fin",
  arms: "arm",
  antennae: "antenna",
  eyes: "eye",
  ears: "ear",
  legs: "leg",
};

const FANG_TEETH = new Set(["fangs", "carnassial", "serrated", "needle", "conical"]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length ? v : undefined;
}

function asRelic(v: unknown): CombatRelic | undefined {
  if (!isRecord(v)) return undefined;
  const kind = str(v.kind);
  const use = str(v.use);
  if (!kind || !use) return undefined;
  return {
    kind,
    matter: str(v.matter) ?? "bone",
    use,
    held: v.held === true || v.held === 1,
  };
}

function sculptureOf(part: Record<string, unknown>): string[] {
  const found: string[] = [];
  const p = isRecord(part.p) ? part.p : undefined;
  for (const src of [part.sculpture, p?.sculpture]) {
    if (typeof src === "string") found.push(src);
    else if (Array.isArray(src)) for (const s of src) if (typeof s === "string") found.push(s);
  }
  return found;
}

function unitsFromParts(parts: unknown[]): { units: CombatUnit[]; claws?: string; sculpture: string[] } {
  const map = new Map<string, { count: number; role?: string }>();
  const sculpture: string[] = [];
  let claws: string | undefined;
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
      const term = str(raw.term) ?? (isRecord(raw.p) ? str(raw.p.term) : undefined);
      if (term && term !== "none" && term !== "hand") claws = term;
      else if (!claws && fam && /claw|talon|pincer|scythe/.test(fam)) claws = fam;
    }
  }
  const units: CombatUnit[] = [];
  for (const [unit, v] of map) {
    if (v.count < 0.5) continue;
    if (unit === "shell") continue;
    units.push({ unit, role: v.role, count: Math.max(1, Math.round(v.count)) });
  }
  return { units, claws, sculpture };
}

function alreadyCombat(input: Record<string, unknown>): boolean {
  return Array.isArray(input.units) && isRecord(input.covering) && typeof input.covering.type === "string" && typeof input.sizeM === "number" && !Array.isArray(input.parts);
}

function normalizeCombat(input: Record<string, unknown>): CombatPhenotype {
  const units = (input.units as CombatUnit[]).map((u) => ({
    unit: String(u.unit),
    role: u.role,
    count: u.count,
  }));
  const covering = input.covering as { type: string };
  const ascent = isRecord(input.ascent)
    ? {
        organ: str(input.ascent.organ),
        level: typeof input.ascent.level === "number" ? input.ascent.level : undefined,
        relic: asRelic(input.ascent.relic),
      }
    : undefined;
  const shell = isRecord(input.shell)
    ? { sculpture: Array.isArray(input.shell.sculpture) ? input.shell.sculpture.map(String) : undefined }
    : undefined;
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
    ecology: str(input.ecology),
    plan: str(input.plan),
    volant: input.volant === true || input.volant === 1,
    stats: isRecord(input.stats) ? (input.stats as Record<string, number>) : undefined,
  };
}

/**
 * Map a live lab phenotype (`Qe.ph`, optionally with `Qe.build`) onto CombatPhenotype.
 * A phenotype that is already a CombatPhenotype is returned normalized.
 * Missing fields become quiet defaults: build medium, no units, skin, beast, 1 m.
 */
export function toCombatPhenotype(input: unknown, hints?: AdapterHints): CombatPhenotype {
  if (!isRecord(input)) {
    return {
      sizeM: 1,
      element: "beast",
      covering: { type: "skin" },
      build: "medium",
      units: [],
    };
  }
  if (alreadyCombat(input)) return normalizeCombat(input);

  const parts = Array.isArray(input.parts) ? input.parts : [];
  const fromParts = unitsFromParts(parts);
  const features: string[] = [];
  for (const key of ["features", "traits", "myth", "anomaly"] as const) {
    const list = input[key];
    if (Array.isArray(list)) for (const item of list) if (typeof item === "string") features.push(item);
  }
  if (Array.isArray(input.adapt)) {
    for (const item of input.adapt) {
      if (typeof item === "string") features.push(item);
      else if (isRecord(item) && typeof item.id === "string") features.push(item.id);
    }
  }

  const head = isRecord(input.head) ? input.head : undefined;
  const teeth = head && isRecord(head.teeth) ? str(head.teeth.type) : str(head?.teeth);
  if (teeth && FANG_TEETH.has(teeth)) features.push(teeth === "fangs" ? "fang" : teeth);

  const coveringRec = isRecord(input.covering) ? input.covering : undefined;
  const covering = str(coveringRec?.type) ?? str(input.covering) ?? "skin";

  const ascentRec = isRecord(input.ascent) ? input.ascent : undefined;
  const ascRec = isRecord(input.asc) ? input.asc : undefined;
  const relic = asRelic(ascentRec?.relic);
  const organ = str(ascentRec?.organ);
  const level = num(ascentRec?.level, num(ascRec?.level, 0));
  const ascent =
    organ || relic || level > 0
      ? { organ, level, relic }
      : undefined;

  let build = str(ascentRec?.build) ?? str(input.build);
  if (!build && isRecord(input.body)) build = str(input.body.build);
  if (!build) build = "medium";

  const sculpture = [...fromParts.sculpture];
  const buildRec = isRecord(hints?.build) ? hints.build : undefined;
  const morph = buildRec && isRecord(buildRec.morph) ? buildRec.morph : undefined;
  const shellObj = morph && isRecord(morph.shell) ? morph.shell : buildRec && isRecord(buildRec.shell) ? buildRec.shell : undefined;
  if (shellObj) {
    if (typeof shellObj.sculpture === "string") sculpture.push(shellObj.sculpture);
    else if (Array.isArray(shellObj.sculpture)) {
      for (const s of shellObj.sculpture) if (typeof s === "string") sculpture.push(s);
    }
  }
  const shell = sculpture.length || covering === "shell" ? { sculpture: [...new Set(sculpture)] } : undefined;

  let stats = hints?.stats ?? (isRecord(input.stats) ? (input.stats as Record<string, number>) : undefined);
  if (!stats && isRecord(input.line) && typeof input.line.vigor === "number") {
    const v = input.line.vigor;
    stats = { vigor: Math.max(0.5, Math.min(1.6, 0.85 + ((v - 128) / 128) * 0.35)) };
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
    ecology: str(input.ecology),
    plan: str(input.plan),
    volant: input.volant === true || input.volant === 1,
    stats,
  };
}
