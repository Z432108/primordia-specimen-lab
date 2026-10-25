import { playAttack } from "./animate.ts";
import { toCombatPhenotype } from "./adapter.ts";
import { resolveBattle, type BattleFighter, type BattleResult } from "./battle.ts";
import { generateAttacks, generateDefense, kitSignature } from "./generate.ts";
import type { Attack, DefenseProfile } from "./types.ts";

interface LabCtx {
  state: {
    ph: unknown;
    build: unknown;
    genome?: { id?: string; seed?: string };
    stage?: string;
    gallery?: Array<{ genome?: { id?: string; seed?: string } }>;
    tab?: string;
  };
  anim?: Parameters<typeof playAttack>[0];
  toast?: (msg: string) => void;
  on?: (ev: string, fn: () => void) => void;
}

interface Remembered {
  id: string;
  name: string;
  stage: string;
  attacks: Attack[];
  defense: DefenseProfile;
}

const memory = new Map<string, Remembered>();

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

function currentRecord(): Remembered | null {
  const ctx = lab();
  if (!ctx?.state?.ph) return null;
  const ph = toCombatPhenotype(ctx.state.ph, { build: ctx.state.build });
  const id = ctx.state.genome?.id ?? "current";
  const stage = ctx.state.stage ?? "";
  const rec: Remembered = {
    id: `${id}@${stage}`,
    name: specimenName(),
    stage,
    attacks: generateAttacks(ph),
    defense: generateDefense(ph),
  };
  memory.set(rec.id, rec);
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
        ...defense.specials.map((s) => el("li", {}, el("code", {}, s.name), text(` ${s.description}`))),
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
      el("span", { class: "chip" }, attack.animationKey),
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

function battleBlock(self: Remembered): HTMLElement {
  const others = [...memory.values()].filter((r) => r.id !== self.id);
  const select = el("select", { id: "combat-foe", "aria-label": "Opponent" }) as HTMLSelectElement;
  if (!others.length) {
    const opt = el("option", { value: "" }, "Open another specimen first");
    select.append(opt);
    select.disabled = true;
  } else {
    for (const foe of others) {
      select.append(el("option", { value: foe.id }, `${foe.name}${foe.stage ? ` · ${foe.stage}` : ""}`));
    }
  }
  const go = el("button", { class: "btn primary small", type: "button", "data-k": "combat-battle" }, "Battle");
  if (!others.length) go.setAttribute("disabled", "");
  const logHost = el("div", { id: "combat-log" });
  go.addEventListener("click", () => {
    const foe = memory.get(select.value);
    if (!foe) return;
    const left: BattleFighter = { id: self.id, name: self.name, attacks: self.attacks, defense: self.defense };
    const right: BattleFighter = { id: foe.id, name: foe.name, attacks: foe.attacks, defense: foe.defense };
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
    logHost,
  );
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
  host.append(
    el(
      "section",
      { class: "sec" },
      el("h2", {}, "Field of arms"),
      el("p", {}, "Attacks and the ward are read from the body. The same specimen always keeps the same kit."),
      el("p", { class: "mono muted" }, `Kit ${sig} · ${rec.attacks.length} attacks`),
      el("div", { class: "row" }, copy),
    ),
    defenseBlock(rec.defense),
    el(
      "section",
      { class: "sec" },
      el("h2", {}, "Attacks"),
      ...rec.attacks.map((attack) =>
        attackBlock(attack, () => {
          const played = playAttack(ctx?.anim, attack.animationKey, rec.defense.massClass);
          if (played.fallback) ctx?.toast?.(`No driver for ${attack.animationKey}. A generic act plays.`);
        }),
      ),
    ),
    battleBlock(rec),
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
