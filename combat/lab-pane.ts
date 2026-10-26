import { performAttack, playAttack } from "./animate.ts";
import { companionOf, LIFE_STAGES, openBattle, scaledPhenotype, type Aim, type Companion } from "./arena.ts";
import { toCombatPhenotype } from "./adapter.ts";
import { autoOrder, boutResult, commit, finishBout, offers, openRound, resolveBattle, startBout, type BattleEvent, type BattleFighter, type BattleResult, type Order } from "./battle.ts";
import { ATTACK_LEXICON, ELEMENTS, fieldHash, MOTIONS, WARD_LEXICON, type Technique } from "./catalogue.ts";
import { playFx } from "./fx.ts";
import { generateAttacks, generateDefense, kitSignature, techniqueBorne } from "./generate.ts";
import type { Attack, CombatPhenotype, DefenseProfile, MassClass } from "./types.ts";

interface LabCtx {
  state: {
    ph: unknown;
    build: unknown;
    genome?: { id?: string; seed?: string; ecology?: string };
    stage?: string;
    ecology?: string;
    gallery?: Array<{ genome?: { id?: string; seed?: string } }>;
    tab?: string;
  };
  anim?: Parameters<typeof performAttack>[0];
  toast?: (msg: string) => void;
  on?: (ev: string, fn: () => void) => void;
}

interface Remembered {
  id: string;
  name: string;
  stage: string;
  attacks: Attack[];
  defense: DefenseProfile;
  companion: Companion;
  genomeId?: string;
}

const memory = new Map<string, Remembered>();
const PAGE = 8;
let fieldOpen = false;
let wardOpen = false;
let page = 0;
let wardPage = 0;
let elementFilter = "all";
let motionFilter = "all";
let borneOnly = true;
let query = "";
let showToken = 0;

function sleep(ms: number, token: number): Promise<boolean> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(token === showToken), ms);
  });
}

function inhabit(ph: CombatPhenotype, ctx: LabCtx): CombatPhenotype {
  if (ph.ecology) return ph;
  const ecology = ctx.state.ecology || ctx.state.genome?.ecology;
  return ecology ? { ...ph, ecology } : ph;
}

function sheetStats(raw: unknown, ph: CombatPhenotype): CombatPhenotype {
  if (ph.stats?.power != null && ph.stats.guard != null && ph.stats.swift != null) return ph;
  const scores = (window as unknown as {
    __lab?: { scores?: (body: unknown, affinity?: string) => Record<string, number> | null };
  }).__lab?.scores;
  if (!scores) return ph;
  const affinity = lab()?.state?.genome && (lab()?.state?.genome as { statAffinity?: string }).statAffinity;
  const values = scores(raw, affinity);
  if (!values?.power) return ph;
  return { ...ph, stats: values };
}

function fromGenerator(genome: unknown, stage: string, fallback: unknown, build: unknown): CombatPhenotype | null {
  const read = (window as unknown as {
    __lab?: { read?: (body: unknown, stage?: string) => { ph?: unknown } | null };
  }).__lab?.read;
  const card = genome && read ? read(genome, stage) : null;
  const raw = card?.ph ?? fallback;
  if (!raw) return null;
  return sheetStats(raw, toCombatPhenotype(raw, { build }));
}

function currentPhenotype(): CombatPhenotype | null {
  const ctx = lab();
  if (!ctx?.state?.ph) return null;
  const stage = ctx.state.stage || "Apex";
  const ph = fromGenerator(ctx.state.genome, stage, ctx.state.ph, ctx.state.build);
  return ph ? inhabit(ph, ctx) : null;
}

function lab(): LabCtx | null {
  const ctx = (window as unknown as { __lab?: { ctx?: LabCtx } }).__lab?.ctx;
  return ctx ?? null;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, string | undefined> = {},
  ...kids: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === "class") node.className = v;
    else node.setAttribute(k, v);
  }
  for (const kid of kids) node.append(kid);
  return node;
}

function text(s: string): Text {
  return document.createTextNode(s);
}

function specimenName(): string {
  return document.querySelector(".common")?.textContent?.trim() || "This specimen";
}

function remember(id: string, name: string, stage: string, ph: CombatPhenotype, genomeId?: string): Remembered {
  const attacks = generateAttacks(ph);
  const defense = generateDefense(ph);
  const rec: Remembered = {
    id,
    name,
    stage,
    attacks,
    defense,
    companion: companionOf(id, name, stage, ph, defense, genomeId),
    genomeId,
  };
  memory.set(rec.id, rec);
  return rec;
}

function currentRecord(): Remembered | null {
  const ctx = lab();
  if (!ctx?.state?.ph) return null;
  const stage = ctx.state.stage || "Apex";
  const ph = fromGenerator(ctx.state.genome, stage, ctx.state.ph, ctx.state.build);
  if (!ph) return null;
  const lived = inhabit(ph, ctx);
  const id = ctx.state.genome?.id ?? "current";
  const name = specimenName();
  const rec = remember(`${id}@${stage}`, name, stage, lived, id);
  for (const age of LIFE_STAGES) {
    if (age === stage) continue;
    const agedRaw = ctx.state.genome
      ? fromGenerator(ctx.state.genome, age, null, ctx.state.build)
      : scaledPhenotype(lived, stage, age);
    if (!agedRaw) continue;
    const aged = ctx.state.genome ? inhabit(agedRaw, ctx) : agedRaw;
    remember(`${id}@${age}`, name, age, aged, id);
  }
  return rec;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function defenseBlock(defense: DefenseProfile): HTMLElement {
  const resists = Object.entries(defense.elementalResist).sort((a, b) => b[1] - a[1]);
  const chips = resists.map(([k, v]) =>
    el(
      "span",
      { class: v < 0 ? "chip resist weak" : "chip resist" },
      `${k} ${v > 0 ? "+" : ""}${pct(v)}`,
    ),
  );
  const specials = defense.specials.length
    ? el(
        "ul",
        { class: "list" },
        ...defense.specials.map((s) => {
          const glimpse = el("button", { class: "btn small", type: "button" }, "Glimpse");
          glimpse.addEventListener("click", () => {
            const ward = WARD_LEXICON.find((w) => w.name === s.name);
            playFx({
              element: ward?.element ?? "earth",
              motion: ward?.motion ?? "aegis",
              seed: ward?.fxSeed ?? 1,
              title: s.name,
              intensity: 0.85,
            });
          });
          return el(
            "li",
            { class: "combat-ward" },
            el("div", {}, el("code", {}, s.name), text(` ${s.description}`)),
            glimpse,
          );
        }),
      )
    : el("p", { class: "muted" }, "No special ward. The hide is what it is.");
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
      el("dd", { class: "mono" }, pct(defense.knockbackResist)),
      ...(defense.sheet
        ? (["power", "guard", "swift", "focus", "vigor", "spirit"] as const).flatMap((key) => [
            el("dt", {}, key),
            el("dd", { class: "mono" }, String(defense.sheet?.[key] ?? "—")),
          ])
        : []),
    ),
    chips.length ? el("div", { class: "chips" }, ...chips) : el("p", { class: "muted" }, "No marked elemental ward."),
    specials,
    ...defense.notes.map((n) => el("p", { class: "muted" }, n)),
  );
}

function attackBlock(attack: Attack, onPreview: () => void): HTMLElement {
  const preview = el("button", { class: "btn small", type: "button", "data-k": `combat-prev-${attack.id}` }, "Preview");
  preview.addEventListener("click", onPreview);
  return el(
    "article",
    { class: "combat-atk" },
    el(
      "div",
      { class: "combat-top" },
      el("h3", { class: "combat-name" }, attack.name),
      preview,
    ),
    el(
      "div",
      { class: "chips" },
      el("span", { class: "chip" }, attack.type),
      el("span", { class: "chip" }, attack.element),
      el("span", { class: "chip" }, attack.fxMotion ?? attack.animationKey),
      ...(attack.manner ? [el("span", { class: "chip" }, attack.manner)] : []),
    ),
    el(
      "dl",
      { class: "kv combat-stats" },
      el("dt", {}, "Power"),
      el("dd", { class: "mono" }, String(attack.power)),
      el("dt", {}, "Range"),
      el("dd", { class: "mono" }, String(attack.range)),
      el("dt", {}, "Cooldown"),
      el("dd", { class: "mono" }, String(attack.cooldown)),
    ),
    el("p", {}, attack.description),
  );
}

interface BodyCard {
  id: string;
  name: string;
  stage: string;
  seed?: string;
  source?: string;
  ph: unknown;
}

function duelBook(): { roster?: () => BodyCard[]; claim?: (seed: string) => BodyCard } | null {
  const duel = (window as unknown as { __lab?: { duel?: { roster?: () => BodyCard[]; claim?: (seed: string) => BodyCard } } }).__lab?.duel;
  return duel ?? null;
}

function knownBodies(): Remembered[] {
  const ctx = lab();
  const book = duelBook();
  const cards = book?.roster?.() ?? [];
  const found: Remembered[] = [];
  for (const card of cards) {
    if (!card?.id || !card.stage || !card.ph) continue;
    const ph = ctx ? inhabit(toCombatPhenotype(card.ph), ctx) : toCombatPhenotype(card.ph);
    found.push(remember(`${card.id}@${card.stage}`, card.name || "Unnamed", card.stage, ph, card.id));
  }
  if (found.length) return found;
  const self = currentRecord();
  return self ? [...memory.values()].filter((r) => !self.genomeId || r.genomeId === self.genomeId) : [];
}

function battleBlock(self: Remembered): HTMLElement {
  const bodies = knownBodies();
  const order = LIFE_STAGES as readonly string[];
  bodies.sort((a, b) => {
    const ga = a.genomeId === self.genomeId ? 0 : 1;
    const gb = b.genomeId === self.genomeId ? 0 : 1;
    if (ga !== gb) return ga - gb;
    const sa = order.indexOf(a.stage);
    const sb = order.indexOf(b.stage);
    if (sa !== sb) return (sa < 0 ? 99 : sa) - (sb < 0 ? 99 : sb);
    return a.name.localeCompare(b.name);
  });
  const labelOf = (rec: Remembered) => {
    const mine = rec.genomeId === self.genomeId;
    return mine ? `${rec.stage} · ${rec.name}` : `${rec.name} · ${rec.stage}`;
  };
  const fill = (select: HTMLSelectElement, prefer: string) => {
    for (const rec of bodies) {
      const opt = el("option", { value: rec.id }, labelOf(rec)) as HTMLOptionElement;
      if (rec.id === prefer) opt.selected = true;
      select.append(opt);
    }
  };
  const leftSel = el("select", { id: "combat-left", "aria-label": "First companion" }) as HTMLSelectElement;
  const rightSel = el("select", { id: "combat-foe", "aria-label": "Second companion" }) as HTMLSelectElement;
  const leftPrefer = bodies.find((r) => r.id === self.id)?.id ?? bodies[0]?.id ?? "";
  const otherGenome = bodies.find((r) => r.genomeId && r.genomeId !== self.genomeId);
  const nextAge = bodies.find((r) => r.genomeId === self.genomeId && r.stage === order[(order.indexOf(self.stage) + 1) % order.length]);
  const rightPrefer = otherGenome?.id ?? nextAge?.id ?? bodies.find((r) => r.id !== leftPrefer)?.id ?? "";
  if (!bodies.length) {
    leftSel.append(el("option", { value: "" }, "No body is ready"));
    rightSel.append(el("option", { value: "" }, "No body is ready"));
    leftSel.disabled = true;
    rightSel.disabled = true;
  } else {
    fill(leftSel, leftPrefer);
    fill(rightSel, rightPrefer);
  }
  const seed = el("input", { id: "combat-seed", type: "text", placeholder: "Known seed, or seed@Apex", "aria-label": "Known seed" }) as HTMLInputElement;
  const bring = el("button", { class: "btn small", type: "button", "data-k": "combat-seed-bring" }, "Bring seed");
  bring.addEventListener("click", () => {
    const raw = seed.value.trim();
    const book = duelBook();
    if (!raw || !book?.claim) return;
    try {
      const card = book.claim(raw);
      lab()?.toast?.(`${card.name} can be called to the ground.`);
      seed.value = "";
      paint(hostOf(bring));
    } catch {
      lab()?.toast?.("That seed did not grow a body.");
    }
  });
  seed.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      bring.click();
    }
  });
  const go = el("button", { class: "btn primary small", type: "button", "data-k": "combat-battle" }, "Battle");
  if (bodies.length < 2) go.setAttribute("disabled", "");
  const logHost = el("div", { id: "combat-log" });
  go.addEventListener("click", () => {
    const a = memory.get(leftSel.value);
    const b = memory.get(rightSel.value);
    if (!a || !b) return;
    if (a.id === b.id) {
      lab()?.toast?.("Pick two different bodies.");
      return;
    }
    const token = ++showToken;
    const left: BattleFighter = { id: a.id, name: a.name, attacks: a.attacks, defense: a.defense };
    const right: BattleFighter = { id: b.id, name: b.name, attacks: b.attacks, defense: b.defense };
    go.setAttribute("disabled", "");
    void playSteered(token, logHost, left, right, a, b, () => {
      go.removeAttribute("disabled");
    });
  });
  const hereSeed = lab()?.state.genome?.seed;
  return el(
    "section",
    { class: "sec" },
    el("h2", {}, "Battle"),
    el(
      "p",
      {},
      "Any two bodies can meet. The one on the table is here at every age. Kept companions come as adults. A seed you know can be brought, and seed@Sprout through seed@Sovereign calls that age.",
    ),
    hereSeed ? el("p", { class: "mono muted" }, hereSeed) : el("p", { class: "muted" }, ""),
    el("div", { class: "combat-pair" }, leftSel, rightSel),
    el("div", { class: "row" }, seed, bring, go),
    logHost,
  );
}

function showBlow(event: BattleEvent, self: Remembered, foe: Remembered, aim?: Aim) {
  if (event.attackId === "close") return;
  if (event.damage === 0 && event.attackId !== "guard" && event.attackId !== "knit") return;
  const dueling = (window as unknown as { __primordiaDuel?: boolean }).__primordiaDuel;
  const ctx = lab();
  const actor = event.actorId === self.id ? self : foe;
  const attack = actor.attacks.find((a) => a.id === event.attackId);
  const intensity = Math.min(1.55, 0.65 + event.damage / 36);
  if (!dueling && event.actorId === self.id && attack && event.attackId !== "dot" && event.attackId !== "knit") {
    playAttack(ctx?.anim, attack.animationKey, self.defense.massClass);
  } else if (!dueling && event.actorId !== self.id && event.attackId !== "knit") {
    try {
      ctx?.anim?.act?.("shake_off");
    } catch {
      /* this body has no flinch */
    }
  }
  playFx({
    element: event.element || attack?.element || "beast",
    motion: event.fxMotion || (event.attackId === "knit" ? "knit" : event.attackId === "dot" ? "brume" : attack?.fxMotion || "burst"),
    seed: event.fxSeed || attack?.fxSeed || 3,
    mass: actor.defense.massClass,
    title: event.attackName,
    intensity: Math.min(1.7, (event.attackId === "dot" ? 0.55 : intensity) * (dueling ? 1.25 : 1)),
    from: aim?.from,
    toward: aim?.to,
  });
}

async function playSteered(
  token: number,
  host: HTMLElement,
  left: BattleFighter,
  right: BattleFighter,
  self: Remembered,
  foe: Remembered,
  done: () => void,
) {
  const ground = self.companion.ecology || foe.companion.ecology || "";
  const bout = startBout(left, right, ground || undefined);
  const stage = openBattle(self.companion, foe.companion);
  const waitChoice = (): Promise<Order | "finish"> =>
    new Promise((resolve) => {
      const offer = offers(bout);
      const hostEl = document.getElementById("primordia-calls") ?? host;
      const buttons = offer.attacks
        .filter((attack) => attack.ready)
        .map((attack) => {
          const button = el("button", { type: "button" }, attack.reaches ? attack.name : `${attack.name} · short`);
          button.addEventListener("click", () => resolve({ kind: "attack", index: attack.index }));
          return button;
        });
      if (offer.canClose) {
        const close = el("button", { type: "button" }, "Step in");
        close.addEventListener("click", () => resolve({ kind: "close" }));
        buttons.push(close);
      }
      if (offer.canGuard) {
        const guard = el("button", { type: "button" }, "Guard");
        guard.addEventListener("click", () => resolve({ kind: "guard" }));
        buttons.push(guard);
      }
      const auto = el("button", { type: "button" }, "Let it choose");
      auto.addEventListener("click", () => resolve(autoOrder(bout)));
      hostEl.replaceChildren(...buttons, auto);
      window.setTimeout(() => resolve(autoOrder(bout)), 1400);
    });
  try {
    const placed = await stage.ready;
    if (token !== showToken) return;
    while (!bout.over && token === showToken) {
      const opened = openRound(bout);
      for (const event of opened) {
        if (token !== showToken) return;
        const aim = stage.blow(event);
        showBlow(event, self, foe, aim);
      }
      if (bout.over) break;
      const choice = await waitChoice();
      if (token !== showToken) return;
      const events = choice === "finish" ? finishBout(bout) : commit(bout, choice);
      for (const event of events) {
        if (token !== showToken) return;
        host.replaceChildren(
          el("p", { class: "mono" }, `${self.name} ${bout.leftHp} · ${foe.name} ${bout.rightHp}`),
          el("ul", { class: "list" }, ...bout.log.slice(-6).map((entry, n, all) => el("li", { class: n === all.length - 1 ? "combat-now" : "" }, entry.text))),
        );
        const aim = stage.blow(event);
        showBlow(event, self, foe, aim);
        const ok = await sleep(choice === "finish" ? 700 : placed ? 1600 : 900, token);
        if (!ok) return;
      }
    }
    paintLog(host, boutResult(bout), self, foe);
    stage.finish(bout.winnerId);
    document.getElementById("primordia-calls")?.replaceChildren();
    done();
  } finally {
    if (token !== showToken) stage.close();
    else window.setTimeout(() => stage.close(), 1400);
  }
}

async function playLog(
  token: number,
  host: HTMLElement,
  result: BattleResult,
  self: Remembered,
  foe: Remembered,
  done: () => void,
) {
  const stage = openBattle(self.companion, foe.companion);
  try {
    const placed = await stage.ready;
    if (token !== showToken) return;
    if (!placed) {
      host.replaceChildren(el("p", { class: "muted" }, "The two ages are not both standing in the habitat yet."));
    }
    for (let i = 0; i < result.log.length; i++) {
      if (token !== showToken) return;
      const event = result.log[i]!;
      const winner =
        result.winnerId === self.id ? self.name : result.winnerId === foe.id ? foe.name : "Neither";
      host.replaceChildren(
        el("p", { class: "muted" }, i + 1 < result.log.length ? "Both are on the field." : result.winnerId ? `${winner} stands.` : "Neither falls."),
        el(
          "ul",
          { class: "list" },
          ...result.log.slice(0, i + 1).map((entry, n) =>
            el("li", { class: n === i ? "combat-now" : "" }, entry.text),
          ),
        ),
      );
      const aim = stage.blow(event);
      showBlow(event, self, foe, aim);
      const ok = await sleep(placed ? 1900 : 1500, token);
      if (!ok) return;
    }
    paintLog(host, result, self, foe);
    stage.finish(result.winnerId);
    done();
  } finally {
    if (token !== showToken) stage.close();
    else window.setTimeout(() => stage.close(), 1400);
  }
}

function previewTechnique(tech: Technique, mass: MassClass) {
  performAttack(
    lab()?.anim,
    {
      animationKey: tech.animationKey,
      element: tech.element,
      fxMotion: tech.motion,
      fxSeed: tech.fxSeed,
      name: tech.name,
    },
    mass,
    1,
  );
}

function filteredTechniques(ph: CombatPhenotype | null): Technique[] {
  const q = query.trim().toLowerCase();
  return ATTACK_LEXICON.filter((tech) => {
    if (elementFilter !== "all" && tech.element !== elementFilter) return false;
    if (motionFilter !== "all" && tech.motion !== motionFilter) return false;
    if (borneOnly && (!ph || !techniqueBorne(ph, tech))) return false;
    if (!q) return true;
    return `${tech.name} ${tech.motion} ${tech.type} ${tech.noun}`.toLowerCase().includes(q);
  });
}

function fieldSection(ph: CombatPhenotype | null, equipped: Set<string>, mass: MassClass): HTMLElement {
  const list = filteredTechniques(ph);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  if (page > pages - 1) page = 0;
  const slice = list.slice(page * PAGE, page * PAGE + PAGE);
  const borne = ph ? ATTACK_LEXICON.filter((tech) => techniqueBorne(ph, tech)).length : 0;
  const toggle = el("button", { class: "btn small", type: "button" }, fieldOpen ? "Close the field" : "Open the field");
  toggle.addEventListener("click", () => {
    fieldOpen = !fieldOpen;
    paint(hostOf(toggle));
  });
  const witness = el("button", { class: "btn primary small", type: "button" }, "Witness four");
  witness.addEventListener("click", () => {
    if (!ph) return;
    const token = ++showToken;
    const pool = ATTACK_LEXICON.filter((tech) => techniqueBorne(ph, tech) && !equipped.has(tech.id));
    const source = pool.length >= 4 ? pool : ATTACK_LEXICON.filter((tech) => tech.element === (ph.element || "beast"));
    if (!source.length) return;
    const start = fieldHash(`${ph.element}:${ph.sizeM}:${ph.build ?? ""}`) % source.length;
    const chosen: Technique[] = [];
    for (let i = 0; chosen.length < 4 && i < source.length; i++) {
      const tech = source[(start + i * 97) % source.length]!;
      if (!chosen.some((c) => c.motion === tech.motion)) chosen.push(tech);
    }
    void (async () => {
      for (const tech of chosen) {
        if (token !== showToken) return;
        previewTechnique(tech, mass);
        const ok = await sleep(1500, token);
        if (!ok) return;
      }
    })();
  });
  const head = el(
    "section",
    { class: "sec" },
    el("h2", {}, "The wider field"),
    el(
      "p",
      {},
      `The field holds ${ATTACK_LEXICON.length.toLocaleString()} attack performances and ${WARD_LEXICON.length.toLocaleString()} wards. This body can bear ${borne.toLocaleString()} of the blows. A fight still carries six, so the weight stays fair.`,
    ),
    el("div", { class: "row" }, toggle, witness),
  );
  if (!fieldOpen) return head;

  const elementSel = el("select", { id: "combat-element", "aria-label": "Element" }) as HTMLSelectElement;
  elementSel.append(el("option", { value: "all" }, "Every element"));
  for (const element of ELEMENTS) {
    const opt = el("option", { value: element }, element) as HTMLOptionElement;
    if (element === elementFilter) opt.selected = true;
    elementSel.append(opt);
  }
  elementSel.addEventListener("change", () => {
    elementFilter = elementSel.value;
    page = 0;
    paint(hostOf(elementSel));
  });
  const motionSel = el("select", { id: "combat-motion", "aria-label": "Motion" }) as HTMLSelectElement;
  motionSel.append(el("option", { value: "all" }, "Every motion"));
  for (const motion of MOTIONS) {
    const opt = el("option", { value: motion }, motion) as HTMLOptionElement;
    if (motion === motionFilter) opt.selected = true;
    motionSel.append(opt);
  }
  motionSel.addEventListener("change", () => {
    motionFilter = motionSel.value;
    page = 0;
    paint(hostOf(motionSel));
  });
  const search = el("input", {
    id: "combat-find",
    type: "search",
    placeholder: "Find a blow",
    "aria-label": "Find a blow",
    value: query,
  }) as HTMLInputElement;
  search.addEventListener("input", () => {
    query = search.value;
    page = 0;
    const caret = search.selectionStart ?? query.length;
    paint(hostOf(search));
    const again = document.getElementById("combat-find") as HTMLInputElement | null;
    again?.focus();
    again?.setSelectionRange(caret, caret);
  });
  const borneBtn = el(
    "button",
    { class: "btn small", type: "button" },
    borneOnly ? "Showing what this body can bear" : "Showing the whole field",
  );
  borneBtn.addEventListener("click", () => {
    borneOnly = !borneOnly;
    page = 0;
    paint(hostOf(borneBtn));
  });
  const prev = el("button", { class: "btn small", type: "button" }, "Previous");
  const next = el("button", { class: "btn small", type: "button" }, "Next");
  if (page <= 0) prev.setAttribute("disabled", "");
  if (page >= pages - 1) next.setAttribute("disabled", "");
  prev.addEventListener("click", () => {
    page -= 1;
    paint(hostOf(prev));
  });
  next.addEventListener("click", () => {
    page += 1;
    paint(hostOf(next));
  });
  const from = list.length === 0 ? 0 : page * PAGE + 1;
  const to = Math.min(list.length, (page + 1) * PAGE);
  const rows = slice.map((tech) => {
    const preview = el("button", { class: "btn small", type: "button" }, "Preview");
    preview.addEventListener("click", () => previewTechnique(tech, mass));
    return el(
      "article",
      { class: "combat-lex-row" },
      preview,
      el(
        "div",
        {},
        el("div", { class: "combat-lex-name" }, tech.name),
        el("p", { class: "muted combat-lex-meta" }, `${tech.type} · ${tech.element} · ${tech.motion} · weight ${tech.basePower}`),
      ),
    );
  });
  head.append(
    el("div", { class: "combat-filters" }, elementSel, motionSel, search, borneBtn),
    el("div", {}, ...rows),
    el("div", { class: "row" }, prev, el("span", { class: "mono muted" }, `${from}–${to} of ${list.length}`), next),
  );
  return head;
}

function wardSection(): HTMLElement {
  const toggle = el("button", { class: "btn small", type: "button" }, wardOpen ? "Close the wards" : "Open the wards");
  toggle.addEventListener("click", () => {
    wardOpen = !wardOpen;
    paint(hostOf(toggle));
  });
  const section = el(
    "section",
    { class: "sec" },
    el("h2", {}, "Wards"),
    el("p", { class: "muted" }, `${WARD_LEXICON.length.toLocaleString()} ways a body can refuse a little of a blow. A specimen wears a few, not the shelf.`),
    toggle,
  );
  if (!wardOpen) return section;
  const pages = Math.max(1, Math.ceil(WARD_LEXICON.length / PAGE));
  if (wardPage > pages - 1) wardPage = 0;
  const slice = WARD_LEXICON.slice(wardPage * PAGE, wardPage * PAGE + PAGE);
  const prev = el("button", { class: "btn small", type: "button" }, "Previous");
  const next = el("button", { class: "btn small", type: "button" }, "Next");
  if (wardPage <= 0) prev.setAttribute("disabled", "");
  if (wardPage >= pages - 1) next.setAttribute("disabled", "");
  prev.addEventListener("click", () => {
    wardPage -= 1;
    paint(hostOf(prev));
  });
  next.addEventListener("click", () => {
    wardPage += 1;
    paint(hostOf(next));
  });
  section.append(
    el(
      "div",
      {},
      ...slice.map((ward) => {
        const glimpse = el("button", { class: "btn small", type: "button" }, "Glimpse");
        glimpse.addEventListener("click", () => {
          playFx({ element: ward.element, motion: ward.motion, seed: ward.fxSeed, title: ward.name, intensity: 0.85 });
        });
        return el(
          "article",
          { class: "combat-lex-row" },
          glimpse,
          el(
            "div",
            {},
            el("div", { class: "combat-lex-name" }, ward.name),
            el("p", { class: "muted combat-lex-meta" }, ward.description),
          ),
        );
      }),
    ),
    el(
      "div",
      { class: "row" },
      prev,
      el("span", { class: "mono muted" }, `${wardPage * PAGE + 1}–${Math.min(WARD_LEXICON.length, (wardPage + 1) * PAGE)} of ${WARD_LEXICON.length}`),
      next,
    ),
  );
  return section;
}

function hostOf(node: Node): HTMLElement {
  const pane = (node instanceof HTMLElement ? node : node.parentElement)?.closest("[data-pane]");
  return (pane as HTMLElement | null) ?? document.body;
}

function paintLog(host: HTMLElement, result: BattleResult, self: Remembered, foe: Remembered): void {
  const winner =
    result.winnerId === self.id ? self.name : result.winnerId === foe.id ? foe.name : "Neither";
  host.replaceChildren(
    el(
      "p",
      {},
      result.winnerId ? `${winner} stands. ` : "Neither falls. ",
      el("span", { class: "mono" }, `${self.name} ${result.leftHp} · ${foe.name} ${result.rightHp}`),
    ),
    el(
      "ul",
      { class: "list" },
      ...result.log.map((e) => el("li", {}, e.text)),
    ),
  );
}

function copyRecord(rec: Remembered) {
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
    defense: rec.defense,
  };
  const raw = JSON.stringify(payload, null, 2);
  const done = (msg: string) => ctx?.toast?.(msg);
  navigator.clipboard?.writeText(raw).then(
    () => done("Combat record copied."),
    () => done("Could not copy the combat record."),
  );
}

function paint(host: HTMLElement) {
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
  const ph = currentPhenotype();
  host.append(
    el(
      "section",
      { class: "sec" },
      el("h2", {}, "Field of arms"),
      el(
        "p",
        {},
        "Six blows are carried into a fight. Mass still tells, and element still tells, and a single moment is not allowed to spend the whole fight. The same body always keeps the same six.",
      ),
      el("p", { class: "mono muted" }, `Kit ${sig} · ${rec.attacks.length} carried · ${ATTACK_LEXICON.length.toLocaleString()} in the field`),
      el("div", { class: "row" }, copy),
    ),
    defenseBlock(rec.defense),
    el(
      "section",
      { class: "sec" },
      el("h2", {}, "Carried blows"),
      ...rec.attacks.map((attack) =>
        attackBlock(attack, () => {
          const played = performAttack(ctx?.anim, attack, rec.defense.massClass, 1);
          if (played.fallback) ctx?.toast?.(`No driver for ${attack.animationKey}. A generic act plays.`);
        }),
      ),
    ),
    fieldSection(ph, new Set(rec.attacks.map((a) => a.variantId ?? "")), rec.defense.massClass),
    wardSection(),
    battleBlock(rec),
  );
}

function installStyle() {
  let style = document.getElementById("primordia-combat-style");
  if (!style) {
    style = document.createElement("style");
    style.id = "primordia-combat-style";
    document.head.append(style);
  }
  style.textContent = `
    .combat-atk { display: grid; gap: 6px; padding: 12px 0; border-top: 1px solid var(--line); }
    .combat-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .combat-name, .combat-lex-name { margin: 0; font-family: var(--f-display); font-weight: 700; font-size: var(--step-1); }
    .combat-stats { margin-top: 2px; }
    .combat-lex-row { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px; align-items: center; padding: 10px 0; border-top: 1px solid var(--line); }
    .combat-lex-meta { margin: 2px 0 0; }
    .combat-ward { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; }
    .combat-now { background: color-mix(in srgb, var(--accent, var(--lichen, #c2d27d)) 18%, transparent); }
    .combat-filters { display: grid; gap: 8px; margin: 8px 0; }
    .combat-filters select, .combat-filters input { min-height: 36px; width: 100%; box-sizing: border-box; border-radius: 10px; border: 1px solid var(--line); background: var(--panel-2); color: var(--text); padding: 6px 10px; font: inherit; }
    .chip.resist { font-family: var(--f-mono); font-size: 0.68rem; letter-spacing: 0.04em; text-transform: uppercase; padding: 2px 7px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); }
    .chip.resist.weak { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 55%, var(--line)); }
    #combat-foe, #combat-left, #combat-seed { min-height: 36px; border-radius: 10px; border: 1px solid var(--line); background: var(--panel-2); color: var(--text); padding: 6px 10px; font: inherit; }
    .combat-pair { display: grid; gap: 8px; }
    .combat-pair select, #combat-seed { width: 100%; box-sizing: border-box; }
    .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    #combat-seed { flex: 1 1 160px; }
  `;
}

function pane(host: HTMLElement) {
  installStyle();
  paint(host);
}

function boot() {
  const ctx = lab();
  if (!ctx) {
    window.setTimeout(boot, 300);
    return;
  }
  (window as unknown as { __primordiaCombat?: { pane: typeof pane } }).__primordiaCombat = { pane };
  ctx.on?.("shown", () => {
    currentRecord();
  });
  if (ctx.state?.ph) currentRecord();
}

boot();

const combatWindow = window as unknown as { __primordiaCombat?: { pane?: typeof pane; adopt?: (ph: unknown) => unknown } };
combatWindow.__primordiaCombat = {
  ...combatWindow.__primordiaCombat,
  pane,
  adopt(ph: unknown) {
    const mapped = toCombatPhenotype(ph);
    const attacks = generateAttacks(mapped);
    const defense = generateDefense(mapped);
    return {
      element: mapped.element,
      element2: mapped.element2 ?? null,
      covering: mapped.covering.type,
      plan: mapped.plan ?? "",
      loco: mapped.loco ?? "",
      volant: Boolean(mapped.volant),
      sizeM: mapped.sizeM,
      stats: mapped.stats ?? null,
      units: mapped.units.map((u) => ({ unit: u.unit, count: u.count })),
      diet: mapped.diet ?? null,
      attacks: attacks.map((a) => a.template),
      hp: defense.hp,
      edge: defense.edge ?? null,
    };
  },
  audit(leftRaw: unknown, rightRaw: unknown) {
    const issues: string[] = [];
    const note = (s: string) => issues.push(s);
    let left: CombatPhenotype;
    let right: CombatPhenotype;
    try {
      left = toCombatPhenotype(leftRaw);
      right = toCombatPhenotype(rightRaw);
    } catch (err) {
      return { issues: [`map threw ${err}`], ok: false };
    }
    const checkPh = (label: string, raw: unknown, ph: CombatPhenotype) => {
      const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      if (ph.element !== src.element) note(`${label} element ${ph.element} != ${src.element}`);
      const e2 = src.element2 || null;
      if ((ph.element2 ?? null) !== e2) note(`${label} element2`);
      const cover = src.covering && typeof src.covering === "object" ? (src.covering as { type?: string }).type : undefined;
      if (cover && ph.covering.type !== cover) note(`${label} covering`);
      if (!(ph.sizeM > 0) || !Number.isFinite(ph.sizeM)) note(`${label} size`);
      const stats = ph.stats;
      if (stats) {
        for (const key of ["power", "guard", "swift", "focus", "vigor", "spirit"]) {
          const n = stats[key];
          if (n == null || !Number.isFinite(n) || n < 1 || n > 100) note(`${label} stat ${key}=${n}`);
        }
      } else note(`${label} no sheet`);
      const diet = typeof src.diet === "string" ? src.diet : "";
      const grazer = ["herbivore", "photosynth", "lithotroph", "filter", "detritivore", "none"].includes(diet);
      const mouthless = src.head && typeof src.head === "object" && ((src.head as { mouth?: string }).mouth === "none" || (src.head as { mouths?: number }).mouths === 0);
      let attacks: ReturnType<typeof generateAttacks>;
      let defense: ReturnType<typeof generateDefense>;
      try {
        attacks = generateAttacks(ph);
        defense = generateDefense(ph);
      } catch (err) {
        note(`${label} kit threw ${err}`);
        return null;
      }
      if (attacks.length < 3 || attacks.length > 6) note(`${label} kit ${attacks.length}`);
      const ids = new Set(attacks.map((a) => a.id));
      if (ids.size !== attacks.length) note(`${label} duplicate ids`);
      for (const attack of attacks) {
        if (!Number.isFinite(attack.power) || attack.power <= 0) note(`${label} power ${attack.name}`);
        if (!Number.isFinite(attack.range) || attack.range <= 0) note(`${label} range ${attack.name}`);
        if (!Number.isFinite(attack.cooldown) || attack.cooldown < 1) note(`${label} cooldown ${attack.name}`);
      }
      if (grazer && attacks.some((a) => a.template === "fang_bite")) note(`${label} grazer bite`);
      if (mouthless && attacks.some((a) => a.template === "fang_bite" || a.template === "mandible_shear")) note(`${label} mouthless bite`);
      if (!Number.isFinite(defense.hp) || defense.hp < 36) note(`${label} hp ${defense.hp}`);
      if (!Number.isFinite(defense.armor) || defense.armor < 0 || defense.armor > 0.82) note(`${label} armor`);
      return { attacks, defense };
    };
    const kitA = checkPh("A", leftRaw, left);
    const kitB = checkPh("B", rightRaw, right);
    if (!kitA || !kitB) return { issues, ok: false };
    const fighter = (id: string, name: string, kit: NonNullable<typeof kitA>): BattleFighter => ({
      id,
      name,
      attacks: kit.attacks,
      defense: kit.defense,
    });
    let result: BattleResult;
    try {
      result = resolveBattle(fighter("a", "A", kitA), fighter("b", "B", kitB), 24);
    } catch (err) {
      note(`resolve threw ${err}`);
      return { issues, ok: false };
    }
    if (!Number.isFinite(result.leftHp) || !Number.isFinite(result.rightHp)) note("hp not finite");
    if (result.leftHp < 0 || result.rightHp < 0) note("negative hp");
    if (result.winnerId === "a" && result.leftHp <= 0 && result.rightHp > 0) note("winner is dead");
    if (result.winnerId === "b" && result.rightHp <= 0 && result.leftHp > 0) note("winner is dead");
    if (result.leftHp <= 0 && result.rightHp <= 0) note("both dead");
    let seen = 0;
    for (const event of result.log) {
      seen += 1;
      if (!Number.isFinite(event.damage) || event.damage < 0) note(`bad damage ${event.attackName}`);
      if (event.attackId !== "knit" && event.attackId !== "dot" && event.damage > Math.max(kitA.defense.hp, kitB.defense.hp)) note("damage above either body");
    }
    if (seen > 80) note(`log ${seen}`);
    let played: BattleResult | null = null;
    try {
      const bout = startBout(fighter("a", "A", kitA), fighter("b", "B", kitB), left.ecology);
      finishBout(bout);
      played = boutResult(bout);
      if (!played || played.log.length > 120) note(`play log ${played?.log.length}`);
      if (played.leftHp < 0 || played.rightHp < 0) note("play negative hp");
      const landed = played.log.filter((e) => e.damage > 0 && e.attackId !== "dot" && e.attackId !== "knit");
      const whiff = played.log.filter((e) => e.aside === "It falls short.");
      if (played.log.length > 8 && landed.length === 0) note(`no blow landed (${whiff.length} short)`);
    } catch (err) {
      note(`play threw ${err}`);
    }
    return {
      issues,
      ok: issues.length === 0,
      winner: result.winnerId,
      rounds: result.rounds,
      leftHp: result.leftHp,
      rightHp: result.rightHp,
      playRounds: played?.rounds ?? null,
    };
  },
};
