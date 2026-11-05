// Fitman: one app for Fitman, Fitman Max and Fit Woman. State lives in localStorage on the phone;
// nothing leaves the device unless the user shares a backup or feedback. On Android the same page
// runs inside the Fitman app, which adds Samsung Health through window.FitmanAndroid.
import { LIBRARY, SOURCES } from "./library.js";
import * as L from "./logic.js";
import * as G from "./generator.js";

const KEY = "fitman.v1";
/** Fit Woman stored its data under this key on the same address; it is read once and left in place as a backup. */
const LEGACY = "fitwoman.v1";
const VERSION = "2.0";
const A = window.FitmanAndroid || null;
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- state ----------
/**
 * Settings that used to be separate apps. Defaults are chosen so nobody has to change anything:
 * people mostly keep the default, so the default is the real design (Johnson & Goldstein 2003).
 */
const DEFAULT_PROFILE = {
  theme: "groen", rest: "af", rir: false, techniques: false, prefill: true, tipsOpen: false, wake: true,
  weighDay: 0, measures: ["waist"], feedback: true, femaleTopics: false,
};
const THEMES = { groen: ["Groen", "#39735F"], blauw: ["Blauw", "#2F6FA8"], wit: ["Wit", "#F4F6F5"], roze: ["Roze", "#B0306E"] };
const MEASURES = { waist: "Taille", hip: "Heup / billen", chest: "Borst", arm: "Bovenarm" };
const MEASURE_TIPS = { waist: "smalste punt, na uitademen", hip: "breedste punt, voeten tegen elkaar", chest: "over de tepels, armen ontspannen", arm: "dikste punt, arm ontspannen langs je lichaam" };

function normalize(d) {
  const n = { ...L.emptyData(d.program || L.starterProgram()), ...d };
  n.weekPlans = n.weekPlans || [];
  n.savedPrograms = n.savedPrograms || [];
  n.customExercises = n.customExercises || [];
  n.feedback = n.feedback || [];
  n.weights = n.weights || [];
  n.profile = { ...DEFAULT_PROFILE, ...(n.profile || {}) };
  n.health = n.health || { steps: [], weights: [], at: null };
  delete n.settings;
  return n;
}
/** Fit Woman data: same model, plus her own choices (pink, glute coach, silent timer if she had it on). */
function fromFitWoman(old) {
  return normalize({ ...old, profile: {
    theme: "roze", rest: old.settings?.restTimer ? "op" : "uit", rir: true, techniques: true,
    measures: ["hip", "waist"], femaleTopics: true,
  } });
}
/** A backup of the old Android app (Fitman or Fitman Max, Kotlin). The model is the same apart from a few fields. */
const isKotlinBackup = (k) => k && ("programVersion" in k || "restSeconds" in k || "appliedSuggestions" in k);
function fromKotlin(k, flavor = "") {
  const exs = [...(k.program?.days || []).flatMap((x) => x.exercises), ...(k.customExercises || [])];
  const sets = (k.sessions || []).flatMap((s) => s.items.flatMap((i) => i.sets));
  const max = flavor === "max" || k.program?.buildUp === false;
  return normalize({
    program: k.program, sessions: k.sessions || [], weights: (k.weights || []).filter((w) => w.kg), draft: null,
    customExercises: k.customExercises || [], feedback: k.feedback || [], savedPrograms: k.savedPrograms || [],
    genAnswers: k.genAnswers || null,
    profile: {
      rir: max || exs.some((e) => e.rir != null) || sets.some((x) => x.rir != null),
      techniques: max || exs.some((e) => e.dropSets || e.supersetWithNext),
    },
  });
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
    const old = localStorage.getItem(LEGACY);
    if (old) { const d = fromFitWoman(JSON.parse(old)); localStorage.setItem(KEY, JSON.stringify(d)); return d; }
    return null;
  } catch (e) {
    localStorage.setItem(KEY + ".unreadable." + Date.now(), localStorage.getItem(KEY) || "");
    return null;
  }
}
/** null until the welcome screen has made a start, so a new user never lands on an empty app. */
let data = load();
const ui = { schemaView: "huidig", gen: null, tab: "training", openEx: null, schemaDay: null, schemaEx: null, progressEx: null, sheet: null, restStart: 0, restAdvice: 0, restBuzzed: false, plan: null, progView: "training", tip: {}, measure: null, welcomeTheme: "groen" };
const P = () => data.profile;

function save() { if (data) localStorage.setItem(KEY, JSON.stringify(data)); }
function update(f) { data = f(data); save(); render(); }
function editProgram(f) { update((d) => ({ ...d, program: f(d.program) })); }

// Ask the browser to keep the data; a web app on the home screen is also exempt from Safari's 7-day storage cap.
navigator.storage?.persist?.();

// ---------- icons ----------
const I = {
  training: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  schema: '<rect x="4" y="4.5" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 2.5v4M16 2.5v4M4 10h16M8 14h3M8 17h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  progress: '<path d="M5 20V11M11 20V5M17 20v-7M2.5 20h19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  coach: '<path d="M20.5 12a8.5 8.5 0 0 1-12.3 7.6L3.5 20.5l1-4.4A8.5 8.5 0 1 1 20.5 12z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  gear: '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>',
  back: '<path d="m15 18-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  scale: '<path d="M5 20h14l-1.5-12h-11z M9 8a3 3 0 0 1 6 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  shuffle: '<path d="M16 4h4v4M4 20 20 4M20 16v4h-4M15 15l5 5M4 4l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  up: '<path d="m6 15 6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  down: '<path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${I[name]}</svg>`;

// Four tabs within the 3–5 that a bottom bar is made for (Material 3); settings sit behind the gear.
const TABS = [
  ["training", "Training", "training"],
  ["schema", "Schema", "schema"],
  ["progress", "Voortgang", "progress"],
  ["coach", "Coach", "coach"],
];
/** The screen title with the gear: the brand stays small so the task gets the space. */
const header = (title, sub = "") => `<div class="top"><div class="grow"><div class="brand">FITMAN</div><h1>${title}</h1>${sub}</div>
  <button class="iconbtn gear" data-a="tab" data-id="settings" aria-label="Instellingen">${svg("gear")}</button></div>`;
const gluteFocus = () => L.isGluteFocus(data.program);
const gPill = (e) => (gluteFocus() && L.isGlute(e) ? ' <span class="pill glute">bil</span>' : "");

// ---------- small building blocks ----------
const srcText = (src) => (src?.length ? "Bron " + src.map((n) => `[${n}]`).join(", ") + " · zie Instellingen › Bronnen" : "Praktijktip");
const restText = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const field = (label, value, action, extra = "") =>
  `<div class="field"><span>${label}</span><button data-a="${action}" data-by="-1" ${extra} aria-label="${label} lager">−</button><b>${value}</b><button data-a="${action}" data-by="1" ${extra} aria-label="${label} hoger">+</button></div>`;
const toggle = (label, on, action, extra = "") => `<button class="toggle ${on ? "on" : ""}" data-a="${action}" ${extra} role="switch" aria-checked="${on}"><i></i><span class="grow">${label}</span></button>`;

function lineChart(points, color) {
  if (points.length < 2) return `<div class="empty">Na twee metingen verschijnt hier je lijn.</div>`;
  const w = 320, h = 150, pad = 18;
  const vs = points.map((p) => p.v);
  const min = Math.min(...vs), max = Math.max(...vs), span = max - min || 1;
  const x = (i) => pad + (i * (w - 2 * pad)) / (points.length - 1);
  const y = (v) => h - pad - ((v - min) * (h - 2 * pad)) / span;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const dots = points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.v)}" r="${p.record ? 5 : 3.5}" fill="${p.record ? "var(--record)" : color}"/>`).join("");
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Verloop van ${fmtN(min)} tot ${fmtN(max)}">
    <text x="0" y="12" fill="var(--muted)" font-size="10">${fmtN(max)}</text><text x="0" y="${h - 2}" fill="var(--muted)" font-size="10">${fmtN(min)}</text>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>${dots}</svg>`;
}
const fmtN = (n) => L.fmt(Math.round(n * 10) / 10);

function volumeBars(sets) {
  const glute = gluteFocus();
  const keys = Object.keys(L.MUSCLES).filter((m) => (sets[m] || 0) > 0 || !["kuiten", "buikspieren", "schouders-voor"].includes(m));
  return keys.map((m) => {
    const v = sets[m] || 0;
    return `<div class="vol ${glute && m === "bilspieren" ? "glute" : ""}"><span>${L.MUSCLES[m]}</span><div class="track"><div class="band"></div><div class="fill" style="width:${(Math.min(v, 24) / 24) * 100}%"></div></div><b class="end">${L.fmt(v)}</b></div>`;
  }).join("");
}

// ---------- Training ----------
function currentDraft() {
  let dr = data.draft && data.draft.date === L.today() ? L.reconcile(data, data.draft) : L.freshDraft(data, L.nextDayId(data));
  if (dr !== data.draft) { data.draft = dr; save(); }
  return dr;
}

/** On weigh day (or later that week) without a weight yet: ask at the moment it matters (Fogg 2009). */
function weighCard() {
  const wd = P().weighDay;
  if (wd == null || wd < 0) return "";
  const monday = L.mondayOf(L.today());
  const todayIdx = (L.parseDate(L.today()).getDay() + 6) % 7;
  if (todayIdx < wd || allWeights().some((x) => x.kg && x.date >= monday)) return "";
  return `<section class="card nudge row"><span class="nudge-ico">${svg("scale")}</span><span class="grow small">${todayIdx === wd ? "Vandaag is weegdag." : "Je weegdag was deze week."} Wat weeg je?</span><button class="btn outline sm" data-a="measureSheet" data-only="kg">Invullen</button></section>`;
}

function renderTraining() {
  const dr = currentDraft();
  const day = L.findDayNow(data, dr.dayId);
  const w = L.currentWeek(data);
  const monday = L.mondayOf(L.today());
  const plan = L.currentPlan(data);
  const target = L.targetForWeek(data, monday);
  const thisWeek = data.sessions.filter((s) => s.date >= monday).length;
  const toggles = plan
    ? plan.slots.map((x) => ({ id: x.dayId, label: `${L.dayShort(x.date)} · ${L.findDay(data, x.dayId)?.name || ""}` }))
    : data.program.days.map((x) => ({ id: x.id, label: x.name }));
  const groups = L.supersetLabels(day.exercises);
  const open = ui.openEx ?? day.exercises.find((e) => dr.items[e.id]?.some((s) => !s.done))?.id;
  const all = Object.values(dr.items).flat();
  const doneSets = all.filter((s) => s.done).length;

  // Goal gradient: the dots show how close this week's goal is (Kivetz, Urminsky & Zheng 2006).
  let h = header(esc(day.name)) + `
    <div class="row small"><span class="muted grow">${w > 12 ? "Cyclus afgerond" : `Week ${w} van 12`} · deze week</span><span class="weekdots">${Array.from({ length: target }, (_, i) => `<i class="${i < thisWeek ? "on" : ""}"></i>`).join("")}</span><span>${Math.min(thisWeek, target)}/${target}</span></div>
    ${weighCard()}
    ${toggles.length > 1 ? `<div class="seg" role="tablist" aria-label="Kies je training">${toggles.map((t) => `<button class="${t.id === dr.dayId ? "on" : ""}" data-a="day" data-id="${t.id}">${esc(t.label)}</button>`).join("")}</div>` : ""}
    <p class="small muted">${plan ? "Volgens je weekplanning · " : ""}± ${L.estimatedMinutes(day)} min, inclusief rust en warming-up.</p>`;

  if (!day.exercises.length) h += `<div class="empty">${esc(day.name)} heeft nog geen oefeningen. Voeg ze toe in Schema.</div>`;

  day.exercises.forEach((slot, idx) => {
    const e = (dr.swaps[slot.id] && L.exercise(data, dr.swaps[slot.id])) || slot;
    const sets = dr.items[slot.id] || [];
    const done = sets.filter((s) => s.done).length;
    const isOpen = open === slot.id;
    const sub = [
      P().rir && slot.rir != null ? `doel ${slot.rir} RIR` : null,
      slot.dropSets ? `+ ${slot.dropSets} ${slot.dropSets === 1 ? "dropset" : "dropsets"}` : null,
      e.id === slot.id && slot.cue ? esc(slot.cue) : null,
      e.id !== slot.id ? `vervangt ${esc(slot.name)}` : null,
    ].filter(Boolean).join(" · ");
    h += `<section class="card">
      <div class="ex-head">
        <button class="grow" style="text-align:left" data-a="openEx" data-id="${slot.id}" aria-expanded="${isOpen}">
          ${groups[idx] ? `<div class="label" style="color:var(--done)">Superset ${groups[idx]}</div>` : ""}
          <h3>${esc(e.name)}${gPill(e)}</h3>
          ${sub ? `<div class="small ${e.id !== slot.id ? "accent" : "muted"}">${sub}</div>` : ""}
        </button>
        <button class="iconbtn" data-a="shuffle" data-id="${slot.id}" ${sets.some((s) => s.done) ? "disabled" : ""} aria-label="Andere oefening voor dezelfde spier">${svg("shuffle")}</button>
        <div class="meta"><b>${sets.filter((s) => !s.drop).length} × ${e.bodyweight ? "AMRAP" : `${e.repMin}–${e.repMax}`}</b><span class="small" style="color:${done === sets.length && sets.length ? "var(--done)" : "var(--muted)"}">${done}/${sets.length} sets</span></div>
      </div>
      ${sets.some((s) => s.pr) ? '<div><span class="pill record">Persoonlijk record</span></div>' : ""}`;
    if (isOpen) {
      const sg = L.suggestion(data, e);
      const last = L.lastFor(data, e.id, L.today());
      h += `<div class="goal"><p class="small">${esc(sg.text)}</p><p class="tiny muted">Rust ${restText(e.rest)} tussen sets</p></div>`;
      sets.forEach((s, i) => {
        const p = !s.drop && last?.sets[i];
        h += `<div class="stack" style="gap:4px">
          <div class="setrow">
            <span class="setno ${s.drop ? "drop" : ""}">${s.drop ? "D" : i + 1}</span>
            <div class="stepper ${s.done ? "done" : ""}"><button data-a="kgStep" data-id="${slot.id}" data-i="${i}" data-by="-1" aria-label="Minder kg">−</button><input inputmode="decimal" data-in="kg" data-id="${slot.id}" data-i="${i}" value="${esc(s.kg)}" placeholder="${esc(s.hint || "–")}" aria-label="Kilo set ${i + 1}"><span class="unit">${e.bodyweight ? "+kg" : "kg"}</span><button data-a="kgStep" data-id="${slot.id}" data-i="${i}" data-by="1" aria-label="Meer kg">+</button></div>
            <div class="stepper ${s.done ? "done" : ""}"><button data-a="repStep" data-id="${slot.id}" data-i="${i}" data-by="-1" aria-label="Minder reps">−</button><input inputmode="numeric" data-in="reps" data-id="${slot.id}" data-i="${i}" value="${esc(s.reps)}" placeholder="${s.goal ?? "–"}" aria-label="Reps set ${i + 1}"><span class="unit">reps</span><button data-a="repStep" data-id="${slot.id}" data-i="${i}" data-by="1" aria-label="Meer reps">+</button></div>
            <button class="check ${s.done ? "on" : ""}" data-a="done" data-id="${slot.id}" data-i="${i}" data-idx="${idx}" aria-label="Set ${i + 1} klaar">${svg("check")}</button>
          </div>
          ${s.drop || !P().rir ? "" : `<div class="rir"><span>RIR</span>${[0, 1, 2, 3, 4].map((n) => `<button class="${s.rir === n ? "on" : ""} ${slot.rir === n ? "target" : ""}" data-a="rir" data-id="${slot.id}" data-i="${i}" data-n="${n}">${n === 4 ? "4+" : n}</button>`).join("")}</div>`}
          ${p ? `<div class="prev">Vorige keer ${L.fmt(p.kg)} kg × ${p.reps}${p.rir != null ? ` · ${p.rir} RIR` : ""}${s.goal ? ` · doel ${s.goal}` : ""}</div>` : ""}
        </div>`;
      });
      // Progressive disclosure: the tip is one tap away instead of pushing the sets down.
      if (e.tip) {
        const tipOpen = ui.tip[slot.id] ?? P().tipsOpen;
        h += `<button class="tipbtn" data-a="tipToggle" data-id="${slot.id}" aria-expanded="${tipOpen}"><span class="grow">Techniektip en bron</span>${svg(tipOpen ? "up" : "down")}</button>`;
        if (tipOpen) h += `<div class="tip">${esc(e.tip)}<div class="tiny">${srcText(e.src)}</div></div>`;
      }
    }
    h += `</section>`;
  });
  h += `<button class="btn primary block big" data-a="finish" ${doneSets ? "" : "disabled"}>Training afronden · ${doneSets}/${all.length} sets</button>`;
  return h;
}

function editSet(exId, i, f) {
  const dr = currentDraft();
  const list = [...dr.items[exId]];
  list[i] = f(list[i]);
  data.draft = { ...dr, items: { ...dr.items, [exId]: list } };
  save();
}

function markDone(slotId, i, idx) {
  const dr = currentDraft();
  const day = L.findDayNow(data, dr.dayId);
  const slot = day.exercises[idx];
  const e = (dr.swaps[slotId] && L.exercise(data, dr.swaps[slotId])) || slot;
  const s = dr.items[slotId][i];
  if (s.done) { editSet(slotId, i, (x) => ({ ...x, done: false, pr: false })); return render(); }
  const reps = parseInt(s.reps, 10) || s.goal;
  if (!reps) { toast("Vul eerst je reps in"); return; }
  const kg = L.toKg(s.kg || s.hint);
  const best = L.bestScore(data, e, L.today());
  const pr = best > 0 && L.setScore(e, { kg, reps }) > best;
  editSet(slotId, i, (x) => ({ ...x, done: true, reps: String(reps), kg: L.fmt(kg), pr }));
  if (pr) toast("Persoonlijk record!");
  buzz(40);
  const items = data.draft.items;
  const hasOpen = (id) => (items[id] || []).some((x) => !x.done);
  ui.openEx = null;
  // A drop set follows straight away, without rest.
  if (items[slotId][i + 1]?.drop && !items[slotId][i + 1].done) { ui.openEx = slotId; return render(); }
  // Superset: go straight to the next exercise of the chain, rest only after the last one.
  const next = slot.supersetWithNext ? day.exercises[idx + 1] : null;
  if (next && hasOpen(next.id)) { ui.restStart = 0; ui.openEx = next.id; return render(); }
  let start = idx;
  while (start > 0 && day.exercises[start - 1].supersetWithNext) start--;
  if (start < idx) ui.openEx = day.exercises.slice(start, idx + 1).find((c) => hasOpen(c.id))?.id ?? null;
  else if (hasOpen(slotId)) ui.openEx = slotId;
  startRest(e.rest);
  render();
}

function finishTraining() {
  const dr = currentDraft();
  const day = L.findDayNow(data, dr.dayId);
  const items = day.exercises.map((slot) => {
    const sets = (dr.items[slot.id] || []).filter((s) => s.done).map((s) => ({ kg: L.toKg(s.kg), reps: parseInt(s.reps, 10) || 0, rir: s.rir, drop: s.drop }));
    return sets.length ? { exId: dr.swaps[slot.id] || slot.id, sets } : null;
  }).filter(Boolean);
  const session = { id: "s" + Date.now(), date: dr.date, dayId: day.id, week: L.weekOf(data, dr.date), items, createdAt: new Date().toISOString() };
  const prev = data.sessions.filter((s) => s.dayId === day.id && s.date < dr.date).sort((a, b) => b.date.localeCompare(a.date))[0];
  const records = items.map((it) => {
    const e = L.exercise(data, it.exId);
    const b = e ? L.bestScore(data, e, dr.date) : 0;
    return e && b > 0 && Math.max(...it.sets.map((s) => L.setScore(e, s))) > b ? e.name : null;
  }).filter(Boolean);
  const vol = L.volume(session);
  const delta = prev ? Math.round((vol / L.volume(prev) - 1) * 100) : null;
  ui.restStart = 0;
  ui.openEx = null;
  update((d) => ({ ...d, sessions: [...d.sessions, session], draft: null }));
  const n = L.inCycle(data).length;
  openSheet(() => `
    <h2>Lekker gewerkt!</h2>
    <p>${esc(day.name)} staat erin. Training ${n} van ${L.cycleSessions(data)} deze cyclus.</p>
    ${records.length ? `<p><span class="pill record">Records</span> ${records.map(esc).join(", ")}</p>` : ""}
    <p class="small muted">Volume ${Math.round(vol).toLocaleString("nl-NL")} kg${delta != null ? ` · ${delta >= 0 ? "+" : ""}${delta}% t.o.v. vorige keer` : ""}</p>
    ${P().feedback ? `<h3>Hoe ging het?</h3>
    <div class="stars">${[1, 2, 3, 4, 5].map((r) => `<button data-a="rate" data-n="${r}" class="${ui.rating === r ? "on" : ""}">${r}</button>`).join("")}</div>
    <textarea class="text" id="rateText" placeholder="Optioneel: wat viel op? (zwaar, pijntje, machine bezet …)"></textarea>
    <div class="actions"><button class="link muted" data-a="close">Sluiten</button><button class="btn primary" data-a="saveRating" data-ctx="${esc(day.name)}">Bewaar</button></div>` : `<div class="actions"><button class="btn primary" data-a="close">Sluiten</button></div>`}`);
}

// ---------- rest timer ----------
// Three ways, set in Instellingen: off, a countdown that buzzes at the end, or a quiet count-up
// that only shows the advised rest (Fit Woman feedback: a ticking clock can feel stressful).
function startRest(sec) {
  if (P().rest === "uit") return;
  ui.restAdvice = sec; ui.restStart = Date.now(); ui.restBuzzed = false;
}
function buzz(ms) {
  try { if (A?.vibrate) A.vibrate(JSON.stringify(ms)); else navigator.vibrate?.(ms); } catch (e) { /* no vibration on this phone */ }
}
function renderTimer() {
  const el = $("#timer");
  if (!data || !ui.restStart || ui.tab !== "training") { el.hidden = true; $("main").classList.remove("timer-on"); return; }
  const gone = Math.floor((Date.now() - ui.restStart) / 1000);
  const ready = gone >= ui.restAdvice;
  el.hidden = false; $("main").classList.add("timer-on");
  if (P().rest === "af") {
    if (ready && !ui.restBuzzed) { ui.restBuzzed = true; buzz([200, 100, 200]); }
    const left = Math.max(0, ui.restAdvice - gone);
    el.innerHTML = `<div class="grow"><div class="label muted">Rust</div><div class="small ${ready ? "accent" : "muted"}">${ready ? "Klaar voor je volgende set" : `van ${restText(ui.restAdvice)}`}</div>
      <div class="bar"><div style="width:${Math.min(100, (gone / Math.max(1, ui.restAdvice)) * 100)}%"></div></div></div>
      <b>${restText(left)}</b><button class="link" data-a="restStop">${ready ? "Verberg" : "Overslaan"}</button>`;
  } else {
    el.innerHTML = `<div class="grow"><div class="label muted">Rust</div><div class="small ${ready ? "accent" : "muted"}">${ready ? "Klaar wanneer jij bent" : `advies ${restText(ui.restAdvice)}`}</div></div>
      <b>${restText(gone)}</b><button class="link" data-a="restStop">Verberg</button>`;
  }
}
setInterval(() => { if (ui.restStart) renderTimer(); }, 1000);

// ---------- Schema ----------
function renderSchema() {
  const top = header("Schema") + schemaTabs();
  if (ui.schemaView === "mijn") return top + renderMySchemas();
  if (ui.schemaView === "nieuw") return top + renderGenerator();
  return top + renderCurrentSchema();
}

function renderCurrentSchema() {
  const p = data.program;
  const raw = p.days.find((x) => x.id === ui.schemaDay) || p.days[0];
  ui.schemaDay = raw.id;
  const week = Math.min(12, L.currentWeek(data));
  const day = L.dayForWeek(data, raw, week);
  const groups = L.supersetLabels(day.exercises);
  const tech = P().techniques;
  let h = `<section class="card row"><div class="grow"><span class="label muted">Huidig schema</span><h3>${esc(p.name)}</h3><p class="small muted">${p.days.length} ${p.days.length === 1 ? "dag" : "dagen"} · ${L.weeklyTarget(data)}× per week</p></div><button class="btn outline sm" data-a="msShare" data-id="">Delen</button></section>
    <p class="small muted">Tik op een oefening om sets, reps, rust en stapgrootte aan te passen. Alles wordt meteen bewaard.</p>
    <div class="chips">${p.days.map((d) => `<button class="chip ${d.id === day.id ? "on" : ""}" data-a="sDay" data-id="${d.id}">${esc(d.name)}</button>`).join("")}${p.days.length < 7 ? `<button class="chip add" data-a="addDay">+ Dag</button>` : ""}</div>
    <section class="card"><div class="row"><div class="grow"><h2 style="margin:0">${esc(day.name)}</h2><p class="small muted">${day.exercises.length} oefeningen · ${day.exercises.reduce((a, e) => a + e.sets, 0)} sets · ± ${L.estimatedMinutes(day)} min</p></div>
      <button class="iconbtn" data-a="moveDay" data-by="-1" aria-label="Dag naar voren">${svg("up")}</button><button class="iconbtn" data-a="moveDay" data-by="1" aria-label="Dag naar achteren">${svg("down")}</button></div>
      <div class="row"><button class="link" data-a="renameDay">Naam wijzigen</button><button class="link" data-a="copyDay">Kopiëren</button>${p.days.length > 1 ? `<button class="link warn" data-a="delDay">Verwijderen</button>` : ""}</div></section>`;
  if (!day.exercises.length) h += `<div class="empty">Nog geen oefeningen op ${esc(day.name)}. Voeg hieronder je eerste oefening toe.</div>`;
  day.exercises.forEach((e, i) => {
    const open = ui.schemaEx === e.id;
    h += `<section class="card"><button class="ex-head" data-a="sEx" data-id="${e.id}" aria-expanded="${open}">
      <div class="grow">${groups[i] ? `<div class="label" style="color:var(--done)">Superset ${groups[i]}</div>` : ""}<h3>${esc(e.name)}${gPill(e)}</h3>
      <div class="small muted">${e.sets} × ${e.bodyweight ? "AMRAP" : `${e.repMin}–${e.repMax}`}${P().rir && e.rir != null ? ` · ${e.rir} RIR` : ""}${e.dropSets ? ` · +${e.dropSets} drop` : ""} · rust ${restText(e.rest)}</div></div></button>`;
    if (open) {
      const x = `data-id="${e.id}"`;
      h += (p.buildUp ? `<p class="small muted">Sets volgen de opbouw: deze week ${e.sets}.</p>` : field("Sets", e.sets, "exSets", x))
        + (e.bodyweight ? "" : field("Reps minimaal", e.repMin, "exMin", x) + field("Reps maximaal", e.repMax, "exMax", x))
        + field("Rust", restText(e.rest), "exRest", x)
        + field("Gewichtsstap", L.fmt(e.inc) + " kg", "exInc", x)
        + (P().rir ? field("Doel-RIR", e.rir ?? "–", "exRir", x) : "")
        + (tech || e.dropSets ? field("Dropsets", e.dropSets, "exDrops", x) : "")
        + ((tech || e.supersetWithNext) && i < day.exercises.length - 1 ? toggle(`Superset met ${esc(day.exercises[i + 1].name)}`, e.supersetWithNext, "exSuper", x) : "")
        + `<input class="text" data-in="cue" ${x} value="${esc(e.cue)}" placeholder="Notitie, bijvoorbeeld stoelstand 4" maxlength="60">
        <div class="row"><button class="iconbtn" data-a="exMove" data-by="-1" ${x} aria-label="Omhoog">${svg("up")}</button><button class="iconbtn" data-a="exMove" data-by="1" ${x} aria-label="Omlaag">${svg("down")}</button>
        <span class="grow"></span><button class="link" data-a="exReplace" ${x}>Vervangen</button><button class="link warn" data-a="exRemove" ${x}>Weg</button></div>`;
    }
    h += `</section>`;
  });
  const sets = L.muscleSets(p, week);
  h += `<button class="btn outline block" data-a="addEx">+ Oefening toevoegen</button>
    <section class="card">${toggle("Sets opbouwen over de cyclus (3 → 4)", !!p.buildUp, "buildUp")}<p class="small muted">${p.buildUp ? L.buildUpText(week) : "Uit: elke oefening houdt de sets die je hierboven instelt."}</p></section>
    <section class="card"><h3>Sets per spiergroep per week</h3><p class="small muted">Telt al je dagen samen. Directe sets tellen als 1, meehelpende als 0,5. Het gekleurde vlak is 10–20 sets, een praktische werkrange [4, 5].${gluteFocus() ? " Voor je billen mag je bovenin zitten." : ""}</p>${volumeBars(sets)}</section>
    <button class="link muted" data-a="reset">Terug naar een startschema</button>`;
  return h;
}

const clampEx = {
  exSets: (e, by) => ({ ...e, sets: Math.min(8, Math.max(1, e.sets + by)) }),
  exMin: (e, by) => ({ ...e, repMin: Math.min(e.repMax, Math.max(1, e.repMin + by)) }),
  exMax: (e, by) => ({ ...e, repMax: Math.min(50, Math.max(e.repMin, e.repMax + by)) }),
  exRest: (e, by) => ({ ...e, rest: Math.min(300, Math.max(30, e.rest + by * 15)) }),
  exInc: (e, by) => { const steps = [0.5, 1, 1.25, 2, 2.5, 5, 10]; const i = Math.max(0, steps.indexOf(e.inc)); return { ...e, inc: steps[Math.min(steps.length - 1, Math.max(0, i + by))] }; },
  exRir: (e, by) => { const v = e.rir == null ? (by > 0 ? 0 : null) : e.rir + by; return { ...e, rir: v == null || v < 0 ? null : Math.min(4, v) }; },
  exDrops: (e, by) => ({ ...e, dropSets: Math.min(3, Math.max(0, e.dropSets + by)) }),
};

function pickerSheet(replaceId) {
  ui.pick = { replaceId, q: "", muscle: replaceId ? L.primaryMuscle(L.exercise(data, replaceId)) : "" };
  openSheet(() => {
    const day = data.program.days.find((x) => x.id === ui.schemaDay);
    const inDay = new Set(day.exercises.map((e) => e.id));
    const q = ui.pick.q.toLowerCase();
    const list = [...LIBRARY, ...data.customExercises]
      .filter((e) => !inDay.has(e.id) && (!ui.pick.muscle || L.primaryMuscle(e) === ui.pick.muscle) && (!q || e.name.toLowerCase().includes(q)))
      .sort((a, b) => (L.isGlute(b) - L.isGlute(a)) || a.name.localeCompare(b.name));
    return `<h2>${replaceId ? "Vervang oefening" : "Oefening toevoegen"}</h2>
      <input class="text" data-in="pickQ" value="${esc(ui.pick.q)}" placeholder="Zoek, bijvoorbeeld thrust" autocomplete="off">
      <div class="chips"><button class="chip ${!ui.pick.muscle ? "on" : ""}" data-a="pickM" data-m="">Alles</button>${Object.entries(L.MUSCLES).map(([k, v]) => `<button class="chip ${ui.pick.muscle === k ? "on" : ""}" data-a="pickM" data-m="${k}">${v}</button>`).join("")}</div>
      <div>${list.map((e) => `<button class="list-row" style="width:100%;text-align:left" data-a="pickEx" data-id="${e.id}"><span class="grow">${esc(e.name)}</span><span class="small muted">${L.MUSCLES[L.primaryMuscle(e)] || ""}</span></button>`).join("") || '<div class="empty">Niets gevonden. Maak hieronder je eigen oefening.</div>'}</div>
      <h3>Eigen oefening</h3>
      <input class="text" id="newName" placeholder="Naam, bijvoorbeeld Glute ham raise" maxlength="40">
      <select class="text" id="newMuscle">${Object.entries(L.MUSCLES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
      <div class="actions"><button class="link muted" data-a="close">Annuleren</button><button class="btn primary" data-a="createEx">Maak en voeg toe</button></div>`;
  });
}

function placeExercise(e) {
  const r = ui.pick.replaceId;
  editProgram((p) => (r ? L.replaceExercise(p, ui.schemaDay, r, e) : L.addExercise(p, ui.schemaDay, { ...e, rir: e.rest >= 120 ? 2 : 1, dropSets: 0, supersetWithNext: false, cue: "" })));
  ui.schemaEx = e.id;
  closeSheet();
}

// ---------- Schema: Mijn schema's and the questionnaire ----------
const SCHEMA_VIEWS = [["huidig", "Huidig"], ["mijn", "Mijn schema's"], ["nieuw", "Nieuw schema"]];
const CORE = ["goal", "focus", "days", "minutes", "level", "tech"];
const EXTRA = ["place", "injuries", "likes", "intensity", "reps"];
const STEPS = [...CORE, "more", ...EXTRA, "result"];
const opt = (map, sel, action, multi = false) =>
  `<div class="chips wrap">${Object.entries(map).map(([k, v]) => `<button class="chip ${(multi ? sel.includes(k) : sel === k) ? "on" : ""}" data-a="${action}" data-k="${esc(k)}">${esc(v)}</button>`).join("")}</div>`;

function schemaTabs() {
  return `<div class="seg" role="tablist" style="margin-bottom:12px">${SCHEMA_VIEWS.map(([id, label]) => `<button class="${ui.schemaView === id ? "on" : ""}" data-a="sView" data-id="${id}">${label}</button>`).join("")}</div>`;
}

/** Keeps the current schema in Mijn schema's before it is replaced, unless it is already there. */
function withBackup(d) {
  const same = JSON.stringify(d.program.days);
  if ((d.savedPrograms || []).some((s) => JSON.stringify(s.program.days) === same)) return d;
  return { ...d, savedPrograms: [...(d.savedPrograms || []), { id: "s" + Date.now(), name: `Vorig: ${d.program.name}`.slice(0, 60), savedAt: L.today(), program: d.program }] };
}
function useProgram(d, p) {
  const b = withBackup(d);
  return { ...b, program: { ...p, startDate: d.program.startDate }, draft: null, weekPlans: (b.weekPlans || []).filter((x) => x.monday < L.mondayOf(L.today())) };
}

function genState() {
  if (!ui.gen) ui.gen = { a: { ...G.defaultAnswers(gluteFocus() ? "fitwoman" : "fitman"), ...(data.genAnswers || {}) }, step: 0, result: null, saved: false };
  return ui.gen;
}

function renderGenerator() {
  const g = genState(), a = g.a, id = STEPS[g.step];
  const q = (title, hint, body) => `<section class="card"><h2 style="margin:0">${title}</h2><p class="small muted">${hint}</p>${body}</section>`;
  let h = "";
  if (id !== "result") {
    // Endowed progress: the bar starts partly filled, which helps people finish.
    const pct = 10 + (90 * g.step) / (STEPS.length - 2);
    const label = g.step < CORE.length ? `Vraag ${g.step + 1} van ${CORE.length}` : id === "more" ? "De basis staat" : `Extra vraag ${g.step - CORE.length} van ${EXTRA.length}`;
    h += `<p class="small muted">${label}</p><div class="cyclebar" style="margin-bottom:12px"><div style="width:${pct}%"></div></div>`;
  }
  const tech = [a.supersets && "superset", a.dropsets && "dropset"].filter(Boolean);
  switch (id) {
    case "goal": h += q("Wat is je hoofddoel?", "Bepaalt je herhalingen en rust.", opt(G.GOALS, a.goal, "gGoal")); break;
    case "focus": h += q("Welke spiergroepen wil je extra laten groeien?", "Kies er maximaal 2, of geen voor een evenwichtig schema.", opt({ "": "Geen voorkeur", ...G.FOCUS }, a.focus.length ? a.focus : [""], "gFocus", true)); break;
    case "days": h += q("Hoeveel dagen per week wil je trainen?", "Lukt het een week niet, dan schuif je met Plan je week in Coach.", field("Dagen per week", a.days, "gDays")); break;
    case "minutes": h += q("Hoe lang mag een training maximaal duren?", "Inclusief warming-up en rust.", opt(Object.fromEntries(G.MINUTES.map((m) => [m, m + " min"])), String(a.minutes), "gMin")); break;
    case "level": h += q("Hoe lang train je al serieus met gewichten?", "Bepaalt hoeveel sets je per week krijgt.", opt(G.LEVELS, a.level, "gLevel")); break;
    case "tech": h += q("Wil je supersets of dropsets?", "Ze besparen tijd. Ik zet ze alleen bij isolatie-oefeningen.", opt({ superset: "Supersets", dropset: "Dropsets", "": "Geen" }, tech.length ? tech : [""], "gTech", true)); break;
    case "more":
      h += `<section class="card hl"><h2 style="margin:0">Nog persoonlijker?</h2><p class="small">Nog 5 korte vragen over je sportschool, klachten, favoriete oefeningen en hoe zwaar je wilt trainen. Duurt ongeveer een minuut.</p>
        <button class="btn primary block" data-a="gTo" data-to="${STEPS.indexOf("result")}">Maak mijn schema</button><button class="btn outline block" data-a="gNext">Nog 5 vragen</button></section>`;
      break;
    case "place": h += q("Waar train je?", "Ik kies alleen oefeningen die daar kunnen.", opt(G.PLACES, a.place, "gPlace")); break;
    case "injuries": h += q("Heb je klachten of blessures?", "Oefeningen die ze kunnen prikkelen laat ik weg. Dit vervangt geen fysiotherapeut.", opt({ "": "Geen", ...G.INJURIES }, a.injuries.length ? a.injuries : [""], "gInj", true)); break;
    case "likes": {
      const rows = Object.entries(L.MUSCLES).map(([m, label]) => {
        const list = LIBRARY.filter((e) => L.primaryMuscle(e) === m);
        if (!list.length) return "";
        return `<div class="label accent" style="margin-top:8px">${label}</div>` + list.map((e) => {
          const st = a.likes.includes(e.id) ? 1 : a.dislikes.includes(e.id) ? 2 : 0;
          return `<button class="list-row" style="width:100%;text-align:left" data-a="gLike" data-id="${e.id}"><span class="grow">${esc(e.name)}</span><b class="small" style="color:${["var(--muted)", "var(--done)", "var(--warn, #E5935F)"][st]}">${["–", "Graag", "Liever niet"][st]}</b></button>`;
        }).join("");
      }).join("");
      h += `<div class="row" style="margin-bottom:12px"><button class="btn outline grow" data-a="gBack">Terug</button><button class="btn primary grow" style="flex:2" data-a="gNext">${a.likes.length || a.dislikes.length ? "Volgende" : "Overslaan"}</button></div>`;
      h += q("Welke oefeningen doe je graag, of liever niet?", "Tik om te wisselen: Graag krijgt voorrang, Liever niet kies ik nooit. Overslaan mag.", rows);
      break;
    }
    case "intensity": h += q("Hoe zwaar wil je trainen?", "RIR is hoeveel herhalingen je nog had gekund. Dichter bij falen geeft iets meer groei, maar kost meer herstel.", opt(G.INTENSITY, a.intensity, "gInt")); break;
    case "reps": h += q("Welk herhalingsbereik vind je prettig?", "Voor spiergroei werkt elk bereik van ongeveer 5 tot 20, dus kies wat je fijn vindt [32].", opt(G.REPS, a.reps, "gReps")); break;
    case "result": {
      const r = g.result;
      if (!r) {
        // A short build moment that shows the rules at work: visible effort makes the result more trusted.
        h += `<section class="card"><h2 style="margin:0">Je schema wordt gebouwd</h2>${["Sets per spier berekenen", "Dagen over je week verdelen", "Oefeningen kiezen", "Passend maken in je tijd"].map((s, i) => `<p class="small build" style="animation-delay:${i * 0.33}s">✓ ${s}</p>`).join("")}</section>`;
        if (!g.timer) g.timer = setTimeout(() => { g.timer = null; g.result = G.generate(g.a); render(); }, 1400);
        break;
      }
      h += `<section class="card hl"><span class="label accent">Jouw schema</span><h2 style="margin:0">${esc(r.program.name)}</h2>${r.summary.map((s) => `<p class="small">• ${esc(s)}</p>`).join("")}</section>`;
      for (const d of r.program.days) {
        h += `<section class="card"><div class="row"><h3 class="grow" style="margin:0">${esc(d.name)}</h3><span class="small muted">± ${G.minutesOf(d.exercises)} min</span></div>
          ${d.exercises.map((e) => `<div class="row small"><span class="grow">${esc(e.name)}${gPill(e)}${e.supersetWithNext ? " ↓ superset" : ""}</span><span class="muted">${e.sets} × ${e.bodyweight ? "AMRAP" : `${e.repMin}–${e.repMax}`}${e.rir != null ? ` · ${e.rir} RIR` : ""}${e.dropSets ? " · +drop" : ""}</span></div>`).join("")}</section>`;
      }
      h += `<button class="btn primary block big" data-a="gUse">Gebruik dit schema</button>
        <button class="btn outline block" data-a="gSave" ${g.saved ? "disabled" : ""}>${g.saved ? "Bewaard in Mijn schema's" : "Alleen bewaren in Mijn schema's"}</button>
        <button class="link" data-a="gTo" data-to="0">Antwoorden aanpassen</button><p class="small muted">Na het kiezen kun je alles nog aanpassen onder Huidig.</p>`;
    }
  }
  if (id !== "result" && id !== "more") {
    const nextLabel = STEPS[g.step + 1] === "result" ? "Maak mijn schema" : "Volgende";
    h += `<div class="row">${g.step > 0 ? `<button class="btn outline grow" data-a="gBack">Terug</button>` : ""}<button class="btn primary grow" style="flex:2" data-a="gNext">${nextLabel}</button></div>`;
  }
  return h;
}

function renderMySchemas() {
  const saved = [...(data.savedPrograms || [])].reverse();
  let h = `<section class="card"><span class="label accent">Huidig schema</span><h3 style="margin:0">${esc(data.program.name)}</h3>
    <p class="small muted">${data.program.days.length} dagen · ${data.program.days.reduce((n, d) => n + d.exercises.length, 0)} oefeningen</p>
    <div class="row"><button class="link" data-a="msSaveCur">Bewaar onder een naam</button><button class="link" data-a="msShare" data-id="">Delen</button></div></section>
    <div class="row"><button class="btn outline grow" data-a="sView" data-id="nieuw">Nieuw schema</button><button class="btn outline grow" data-a="msPaste">Code plakken</button></div>`;
  if (!saved.length) h += `<div class="empty">Nog niets bewaard. Bewaar je huidige schema, maak een nieuw schema met de vragenlijst of plak een code die iemand met je deelde.</div>`;
  for (const s of saved) {
    h += `<section class="card"><h3 style="margin:0">${esc(s.name)}</h3><p class="small muted">${s.program.days.length} dagen · ${esc(s.program.days.map((d) => d.name).join(", "))} · bewaard ${L.niceDate(s.savedAt)}</p>
      <div class="row"><button class="link" data-a="msUse" data-id="${s.id}">Gebruik</button><button class="link" data-a="msShare" data-id="${s.id}">Delen</button><button class="link" data-a="msRename" data-id="${s.id}">Naam</button><button class="link warn" data-a="msDel" data-id="${s.id}">Wis</button></div></section>`;
  }
  return h;
}

const savedById = (id) => (data.savedPrograms || []).find((s) => s.id === id);
function nameSheet(title, current, onSave) {
  ui.nameSave = onSave;
  openSheet(() => `<h2>${title}</h2><input class="text" id="schemaName" value="${esc(current)}" maxlength="60"><div class="actions"><button class="link muted" data-a="close">Annuleren</button><button class="btn primary" data-a="nameOk">Bewaar</button></div>`);
  setTimeout(() => $("#schemaName")?.select(), 50);
}
const genActions = {
  sView: (t) => { ui.schemaView = t.dataset.id; if (t.dataset.id === "nieuw" && ui.gen && STEPS[ui.gen.step] === "result") ui.gen = null; render(); },
  gGoal: (t) => { genState().a.goal = t.dataset.k; render(); },
  gFocus: (t) => {
    const a = genState().a, k = t.dataset.k;
    a.focus = !k ? [] : a.focus.includes(k) ? a.focus.filter((x) => x !== k) : a.focus.length >= 2 ? [...a.focus.slice(1), k] : [...a.focus, k];
    render();
  },
  gDays: (t) => { const a = genState().a; a.days = Math.min(6, Math.max(1, a.days + +t.dataset.by)); render(); },
  gMin: (t) => { genState().a.minutes = +t.dataset.k; render(); },
  gLevel: (t) => { genState().a.level = t.dataset.k; render(); },
  gTech: (t) => { const a = genState().a, k = t.dataset.k; if (k === "superset") a.supersets = !a.supersets; else if (k === "dropset") a.dropsets = !a.dropsets; else { a.supersets = false; a.dropsets = false; } render(); },
  gPlace: (t) => { genState().a.place = t.dataset.k; render(); },
  gInj: (t) => { const a = genState().a, k = t.dataset.k; a.injuries = !k ? [] : a.injuries.includes(k) ? a.injuries.filter((x) => x !== k) : [...a.injuries, k]; render(); },
  gLike: (t) => {
    const a = genState().a, id = t.dataset.id;
    if (a.likes.includes(id)) { a.likes = a.likes.filter((x) => x !== id); a.dislikes = [...a.dislikes, id]; }
    else if (a.dislikes.includes(id)) a.dislikes = a.dislikes.filter((x) => x !== id);
    else a.likes = [...a.likes, id];
    render();
  },
  gInt: (t) => { genState().a.intensity = t.dataset.k; render(); },
  gReps: (t) => { genState().a.reps = t.dataset.k; render(); },
  gNext: () => { const g = genState(); genActions.gTo({ dataset: { to: g.step + 1 } }); },
  gBack: () => { const g = genState(); g.step = Math.max(0, g.step - (STEPS[g.step - 1] === "more" ? 2 : 1)); render(); window.scrollTo(0, 0); },
  gTo: (t) => { const g = genState(); g.step = Math.min(STEPS.length - 1, Math.max(0, +t.dataset.to)); g.result = null; g.saved = false; render(); window.scrollTo(0, 0); },
  gUse: () => confirmSheet("Dit schema gebruiken?", "Je huidige schema wordt bewaard in Mijn schema's, zodat je altijd terug kunt. Gelogde trainingen, records en je startdatum blijven staan. Een weekplanning voor deze week vervalt; plan hem opnieuw in Coach.", "Gebruiken", () => {
    const g = genState();
    update((d) => ({ ...useProgram(d, g.result.program), genAnswers: g.a }));
    ui.gen = null; ui.schemaView = "huidig"; ui.schemaDay = null; render(); toast("Nieuw schema staat klaar");
  }),
  gSave: () => {
    const g = genState();
    g.saved = true;
    update((d) => ({ ...d, genAnswers: g.a, savedPrograms: [...(d.savedPrograms || []), { id: "s" + Date.now(), name: g.result.program.name, savedAt: L.today(), program: g.result.program }] }));
  },
  msSaveCur: () => nameSheet("Naam voor dit schema", data.program.name, (name) => update((d) => ({ ...d, savedPrograms: [...(d.savedPrograms || []), { id: "s" + Date.now(), name, savedAt: L.today(), program: d.program }] }))),
  msRename: (t) => { const s = savedById(t.dataset.id); nameSheet("Naam wijzigen", s.name, (name) => update((d) => ({ ...d, savedPrograms: d.savedPrograms.map((x) => (x.id === s.id ? { ...x, name } : x)) }))); },
  nameOk: () => { const n = $("#schemaName").value.trim(); if (!n) return toast("Geef het schema een naam"); const f = ui.nameSave; ui.nameSave = null; closeSheet(); f?.(n); },
  msShare: (t) => { const s = t.dataset.id ? savedById(t.dataset.id) : null; const p = s ? { ...s.program, name: s.name } : data.program; shareText(p.name, G.shareTextOf(p)); },
  msUse: (t) => { const s = savedById(t.dataset.id); confirmSheet(`${esc(s.name)} gebruiken?`, "Je huidige schema blijft bewaard in Mijn schema's. Gelogde trainingen, records en je startdatum blijven staan.", "Gebruiken", () => { update((d) => useProgram(d, { ...s.program, name: s.name })); ui.schemaView = "huidig"; ui.schemaDay = null; render(); }); },
  msDel: (t) => { const s = savedById(t.dataset.id); confirmSheet(`${esc(s.name)} wissen?`, "Alleen dit bewaarde schema gaat weg. Je huidige schema en je trainingen blijven staan.", "Wissen", () => update((d) => ({ ...d, savedPrograms: d.savedPrograms.filter((x) => x.id !== s.id) }))); },
  msPaste: () => openSheet(() => `<h2>Code plakken</h2><p class="small muted">Plak het hele bericht of alleen de code die begint met FITSCHEMA1. Het schema komt in Mijn schema's.</p><textarea class="text" id="pasteCode"></textarea><div class="actions"><button class="link muted" data-a="close">Annuleren</button><button class="btn primary" data-a="pasteOk">Toevoegen</button></div>`),
  pasteOk: () => {
    const p = G.parseShared($("#pasteCode").value);
    if (!p) return toast("Dit lijkt geen schemacode. Kopieer het bericht opnieuw.");
    closeSheet();
    update((d) => ({ ...d, savedPrograms: [...(d.savedPrograms || []), { id: "s" + Date.now(), name: p.name, savedAt: L.today(), program: { ...p, startDate: d.program.startDate } }] }));
    toast("Toegevoegd aan Mijn schema's");
  },
};

// ---------- Voortgang: training and body under one tab ----------
function renderProgress() {
  const seg = `<div class="seg" role="tablist" aria-label="Voortgang">${[["training", "Training"], ["lichaam", "Lichaam"]].map(([id, label]) => `<button class="${ui.progView === id ? "on" : ""}" data-a="progView" data-id="${id}" role="tab" aria-selected="${ui.progView === id}">${label}</button>`).join("")}</div>`;
  return header("Voortgang") + seg + (ui.progView === "lichaam" ? renderBody() : renderTrainingProgress());
}

function renderTrainingProgress() {
  const w = Math.min(L.currentWeek(data), 12);
  const stats = L.weekStats(data);
  const st = L.streak(data);
  const target = L.weeklyTarget(data);
  const tracked = L.trackedExercises(data);
  const ex = tracked.find((e) => e.id === ui.progressEx) || tracked[0];
  ui.progressEx = ex?.id;
  const series = ex ? L.exerciseSeries(data, ex) : [];
  const max = Math.max(target, ...stats.map((s) => Math.max(s.sessions, s.target)));
  let h = `<div class="tiles">
      <div class="tile"><span class="label muted">Deze week</span><b>${stats[w - 1].sessions}/${stats[w - 1].target}</b><span class="small muted">trainingen</span></div>
      <div class="tile"><span class="label muted">Reeks</span><b>${st.weeks}</b><span class="small muted">weken op schema${st.jokerUsed ? " · joker gebruikt" : ""}</span></div>
      <div class="tile"><span class="label muted">Records</span><b style="color:var(--record)">${L.recordCount(data)}</b><span class="small muted">deze cyclus</span></div>
      <div class="tile"><span class="label muted">Trainingen</span><b>${L.inCycle(data).length}</b><span class="small muted">van ${L.cycleSessions(data)}</span></div>
    </div>
    <section class="card"><h3>Weken op schema</h3>
      <svg class="chart" viewBox="0 0 320 120" role="img" aria-label="Trainingen per week">${stats.map((s, i) => {
        const bh = (s.sessions / max) * 90;
        const on = s.sessions >= s.target;
        return `<rect x="${i * 26 + 4}" y="${100 - bh}" width="20" height="${Math.max(bh, 2)}" rx="4" fill="${on ? "var(--done)" : s.week === w ? "var(--accent)" : "var(--line)"}"/><text x="${i * 26 + 14}" y="116" fill="var(--muted)" font-size="9" text-anchor="middle">${s.week}</text>`;
      }).join("")}<line x1="0" x2="320" y1="${100 - (target / max) * 90}" y2="${100 - (target / max) * 90}" stroke="var(--muted)" stroke-dasharray="4 4"/></svg>
      <p class="small muted">Gekleurd is een week waarin je je weekdoel haalde (bij een aangepaste week: je planning). Eén gemiste week per cyclus breekt je reeks niet.</p></section>`;
  if (ex) h += `<section class="card"><h3>Per oefening</h3>
      <select class="text" data-in="progEx">${tracked.map((e) => `<option value="${e.id}" ${e.id === ex.id ? "selected" : ""}>${esc(e.name)}</option>`).join("")}</select>
      ${series.length ? lineChart(series.map((p) => ({ v: p.value, record: p.record })), "var(--accent)") : '<div class="empty">Nog niet gelogd deze cyclus.</div>'}
      ${series.length ? `<p class="small muted">Laatst: ${L.fmt(series.at(-1).top.kg)} kg × ${series.at(-1).top.reps}. Gouden punten zijn records. ${ex.bodyweight ? "Lijn = totaal reps." : "Lijn = geschat 1RM (Epley)."}</p>` : ""}</section>`;
  h += `<section class="card"><h3>Sets per spiergroep per week</h3>${volumeBars(L.muscleSets(data.program, Math.min(12, L.currentWeek(data))))}</section>`;
  return h;
}

// ---------- Body ----------
/** Manual entries win; Samsung Health fills the weeks without one (Android only). */
function allWeights() {
  const manual = data.weights || [];
  const days = new Set(manual.filter((x) => x.kg).map((x) => x.date));
  const hc = (data.health?.weights || []).filter((x) => !days.has(x.date)).map((x) => ({ ...x, hc: true }));
  return [...manual, ...hc].sort((a, b) => a.date.localeCompare(b.date));
}

/** Weight change per week over the last ~4 weeks, as kg and as % of body weight. */
function weightRate(kg) {
  if (kg.length < 2) return null;
  const last = kg.at(-1);
  const from = L.addDays(last.date, -35);
  const first = kg.find((x) => x.date >= from && x.date < last.date);
  if (!first) return null;
  const weeks = (L.parseDate(last.date) - L.parseDate(first.date)) / (7 * 86400000);
  if (weeks < 1) return null;
  const perWeek = (last.kg - first.kg) / weeks;
  return { perWeek, pct: (perWeek / first.kg) * 100 };
}

function renderBody() {
  const ws = allWeights();
  const kg = ws.filter((x) => x.kg);
  const last = kg.at(-1);
  const rate = weightRate(kg);
  const measures = P().measures.filter((m) => MEASURES[m]);
  let h = `<section class="card"><div class="row"><span class="label muted grow">Gewicht</span>${last ? `<span class="small muted">${L.niceDate(last.date)}${last.hc ? " · Samsung Health" : ""}</span>` : ""}</div>
    ${last ? `<div class="row big-num"><b>${L.fmt(L.round1(last.kg))}</b><span class="muted">kg</span><span class="grow"></span>${rate ? `<span class="small accent">${rate.perWeek >= 0 ? "+" : "−"}${L.fmt(Math.abs(L.round1(rate.perWeek * 10) / 10))} kg/week</span>` : ""}</div>` : ""}
    ${lineChart(kg.map((x) => ({ v: x.kg })), "var(--pastel)")}
    ${rate ? `<p class="small muted">Dat is ${rate.pct >= 0 ? "+" : "−"}${Math.abs(rate.pct).toFixed(2).replace(".", ",")}% per week. Voor spieropbouw met weinig vet is 0,25–0,5% per week een goed tempo [36].</p>` : `<p class="small muted">Weeg jezelf één keer per week, op hetzelfde moment, bijvoorbeeld op je weegdag na het opstaan.</p>`}</section>`;
  h += stepsCard();
  if (measures.length) {
    const cur = measures.includes(ui.measure) ? ui.measure : measures[0];
    ui.measure = cur;
    const pts = ws.filter((x) => x[cur]);
    h += `<section class="card"><span class="label muted">Omtrek</span>
      ${measures.map((m) => {
        const list = ws.filter((x) => x[m]);
        const a = list.at(-1), b = list.at(-2);
        const dlt = a && b ? L.round1(a[m] - b[m]) : null;
        return `<div class="list-row"><span class="grow">${MEASURES[m]}</span><span>${a ? L.fmt(a[m]) + " cm" : "–"}</span><span class="small ${dlt ? "accent" : "muted"}" style="width:56px;text-align:right">${dlt == null ? "" : dlt === 0 ? "±0" : (dlt > 0 ? "+" : "−") + L.fmt(Math.abs(dlt))}</span></div>`;
      }).join("")}
      ${measures.length > 1 ? `<div class="chips">${measures.map((m) => `<button class="chip ${m === cur ? "on" : ""}" data-a="measurePick" data-k="${m}">${MEASURES[m]}</button>`).join("")}</div>` : ""}
      ${lineChart(pts.map((x) => ({ v: x[cur] })), "var(--accent)")}
      ${measures.includes("hip") && measures.includes("waist") ? (() => { const lm = [...ws].reverse().find((x) => x.hip && x.waist); return lm ? `<p class="small muted">Laatste verhouding taille/heup: ${(lm.waist / lm.hip).toFixed(2).replace(".", ",")}</p>` : ""; })() : ""}
      <p class="small muted">Meet elke 2–4 weken. Welke maten je bijhoudt, kies je in Instellingen.</p></section>`;
  }
  h += `<button class="btn primary block" data-a="measureSheet">Meting toevoegen</button>`;
  const manual = [...(data.weights || [])].sort((a, b) => b.date.localeCompare(a.date));
  if (manual.length) h += `<section class="card"><h3>Metingen</h3>${manual.slice(0, 12).map((x) => `<div class="list-row"><span class="grow">${L.niceDate(x.date)}</span><span class="small">${[x.kg && L.fmt(x.kg) + " kg", ...Object.keys(MEASURES).map((m) => x[m] && `${MEASURES[m].split(" ")[0].toLowerCase()} ${L.fmt(x[m])}`)].filter(Boolean).join(" · ")}</span><button class="link muted" data-a="delWeight" data-date="${x.date}">Wis</button></div>`).join("")}</section>`;
  return h;
}

function measureSheet(onlyKg) {
  const ms = onlyKg ? [] : P().measures.filter((m) => MEASURES[m]);
  openSheet(() => `<h2>${onlyKg ? "Weegdag" : "Meting toevoegen"}</h2>
    <label class="small muted" for="wDate">Datum</label><input class="text" id="wDate" type="date" value="${L.today()}">
    <label class="small muted" for="wKg">Gewicht in kg</label><input class="text" id="wKg" inputmode="decimal" placeholder="bijvoorbeeld 81,4">
    ${ms.map((m) => `<label class="small muted" for="w_${m}">${MEASURES[m]} in cm <span class="tiny">(${MEASURE_TIPS[m]})</span></label><input class="text" id="w_${m}" inputmode="decimal">`).join("")}
    <div class="actions"><button class="link muted" data-a="close">Annuleren</button><button class="btn primary" data-a="addWeight">Bewaar</button></div>`);
  setTimeout(() => $("#wKg")?.focus(), 80);
}

// ---------- Samsung Health (Android app only) ----------
function stepsCard() {
  if (!A) return "";
  const st = ui.healthStatus || "unknown";
  if (st === "unavailable") return "";
  const steps = data.health?.steps || [];
  if (st !== "ok" || !steps.length) return `<section class="card row"><span class="nudge-ico">${svg("progress")}</span><div class="grow"><b>Stappen uit Samsung Health</b><p class="small muted">Koppel Health Connect, dan zie je hier je stappen en komt je gewicht er vanzelf bij.</p></div><button class="btn outline sm" data-a="healthConnect">Koppelen</button></section>`;
  const today = steps.find((x) => x.date === L.today())?.steps ?? 0;
  const week = steps.filter((x) => x.date < L.today()).slice(-7);
  const avg = week.length ? Math.round(week.reduce((a, x) => a + x.steps, 0) / week.length) : 0;
  return `<section class="card row"><span class="nudge-ico">${svg("progress")}</span><div class="grow"><b class="big-inline">${today.toLocaleString("nl-NL")}</b> <span class="small muted">stappen vandaag</span><p class="small muted">Uit Samsung Health · gemiddeld ${avg.toLocaleString("nl-NL")} per dag</p></div></section>`;
}
function refreshHealth() {
  if (!A) return;
  try { ui.healthStatus = A.healthStatus(); } catch (e) { ui.healthStatus = "unavailable"; }
  if (ui.healthStatus === "ok") A.readHealth(60);
}
/** Called by the Android app when Health Connect answers. */
window.onFitmanHealth = (json) => {
  try {
    const r = typeof json === "string" ? JSON.parse(json) : json;
    if (r.status) ui.healthStatus = r.status;
    if (r.steps || r.weights) update((d) => ({ ...d, health: { steps: r.steps || d.health.steps, weights: r.weights || d.health.weights, at: new Date().toISOString() } }));
    else render();
  } catch (e) { /* ignore a bad answer */ }
};

// ---------- Coach ----------
/** Knowledge topics; "glute" ones show with a glute focus, "female" ones for the Fit Woman audience. */
const COACH = [
  ["Elke spier 2× per week", "Elke spier twee keer per week trainen is een goede basis; bij hetzelfde weekvolume maakt vaker trainen weinig verschil [1, 2]. Je schema verdeelt je sets daarom over meerdere dagen."],
  ["Volume", "Meer harde sets geeft gemiddeld meer groei, met steeds minder winst per extra set [4, 5]. 10–20 sets per spier per week is een praktische werkrange. Voeg pas sets toe als je goed herstelt en je progressie stokt."],
  ["Volle beweging", "Pak de diepte: training op lange spierlengte geeft minstens zoveel groei als korte reps [19, 20]. Bij leg curls groeiden hamstrings meer in de zittende variant [15]."],
  ["Intensiteit", "Sets tot op 0–3 reps van falen geven vergelijkbare groei met minder vermoeidheid dan elke set tot falen [6, 7]. Zware basisoefeningen op 1–3 reps over, isolatie-oefeningen mogen dichter op falen."],
  ["RIR loggen", "RIR is hoeveel reps je nog over had. Dat schat je steeds beter naarmate je dichter bij falen traint [24]. Had je in alle sets 2 of meer reps over dan je doel, dan zet de app de volgende keer meer gewicht klaar. Aanzetten doe je in Instellingen."],
  ["Progressie", "De app werkt met dubbele progressie: haal je in alle sets de bovenkant van je repbereik, dan stelt hij het volgende gewicht voor. Eerst reps erbij, dan kilo's erbij."],
  ["Eten", "Eiwit helpt: rond 1,6 g per kilo lichaamsgewicht per dag haal je het meeste effect, daarboven wordt de extra winst klein [23]. Voor maximale groei helpt een klein calorieoverschot: zo'n 0,25–0,5% lichaamsgewicht erbij per week [36]."],
  ["Rust", "Langere rust gaf meer groei bij samengestelde oefeningen; boven ~90 seconden wordt het extra effect kleiner [8, 9, 10]. Stel per oefening je eigen rust in bij Schema."],
  ["Billen 2× per week", "Je bilspieren krijgen op beide beendagen directe sets (hip thrust, abductie, kickback, back extension) en meehelpende sets uit squats, lunges en RDL's.", "glute"],
  ["Hip thrust én squat", "In een studie van 9 weken gaven hip thrust en squat vergelijkbare bilgroei; de squat gaf daarnaast meer groei van quadriceps en adductoren [25]. Diep squatten gaf meer bilgroei dan halve squats [18]. Daarom staan ze allebei in je schema.", "glute"],
  ["Vrouwen en spiergroei", "Vrouwen bouwen bij hetzelfde programma relatief net zoveel spier op als mannen [26]. Vrouwen raken bij dezelfde relatieve belasting vaak minder snel vermoeid [27]; in de praktijk kun je daardoor bij isolatie goed uit de voeten met hogere reps (12–20) en kortere rust.", "female"],
  ["Je cyclus", "Je menstruatiecyclus hoeft je schema niet te sturen: onderzoek vindt gemiddeld geen of hooguit een heel klein effect van de cyclusfase op kracht en spiergroei [28, 29]. Voel je je een dag minder, houd dan wat meer reps over (RIR 2–3) in plaats van over te slaan.", "female"],
];

function renderCoach() {
  const nudges = L.coachNudges(data);
  const grow = L.canGrowToFour(data.program);
  const four = L.hasFourthDay(data.program);
  const cw = L.consistentWeeks(data, 3);
  const ready = cw >= L.READY_WEEKS;
  const w = L.currentWeek(data);
  let h = header("Coach");
  if (!A && !window.matchMedia("(display-mode: standalone)").matches && !navigator.standalone)
    h += `<section class="card install"><h3>Zet Fitman op je beginscherm</h3><p class="small">iPhone: open deze pagina in Safari, tik op het deel-icoon (vierkant met pijl) en kies <b>Zet op beginscherm</b>. Android: menu ⋮ › <b>Toevoegen aan startscherm</b>. Dan opent hij als een app en blijven je gegevens bewaard.</p></section>`;
  // One clear next step lowers the threshold to act (ability in the Fogg model).
  h += `<section class="card hl"><span class="label accent">Advies voor deze week</span>${nudges.length
    ? nudges.map((n) => `<div class="stack" style="gap:2px"><span class="label" style="color:var(--done)">${n.tag}</span><p>${esc(n.text)}</p></div>`).join("")
    : `<p>${data.sessions.length ? "Alles loopt volgens plan. Blijf in elke training één rep of een paar kilo winnen; ik meld me hier zodra iets stil komt te staan." : "Log je eerste trainingen. Na een paar weken zie je hier persoonlijke tips: waar je stil staat en waar je zwaarder kunt."}</p>`}</section>`;

  h += renderPlanner();
  h += `<section class="card"><div class="row"><h3 class="grow">Cyclus</h3><span class="small muted">${w > 12 ? "afgerond" : `week ${w} van 12`}</span></div>
    <div class="cyclebar" aria-label="Cyclus"><div style="width:${Math.min(100, (L.inCycle(data).length / L.cycleSessions(data)) * 100)}%"></div></div>
    <p class="small muted">${L.inCycle(data).length} van ${L.cycleSessions(data)} trainingen.${data.program.buildUp ? " " + L.buildUpText(Math.min(12, w)) : ""} ${w > 12 ? "Tijd voor een nieuwe cyclus: start hem in Instellingen of maak een nieuw schema." : ""}</p></section>`;
  if (grow) {
    h += `<section class="card"><h3>${four ? "Je traint 4 dagen per week" : "Uitbouwen naar 4 dagen"}</h3>`;
    if (four) h += `<p class="small">De vierde dag traint je bovenlichaam een tweede keer en je billen een derde keer, lichter en met meer reps. Wordt het te veel, dan kun je zonder schuldgevoel terug: consistent 3× is beter dan wisselend 4×.</p><button class="btn outline" data-a="toThree">Terug naar 3 dagen</button>`;
    else h += `<p class="small">Een vaste gewoonte heeft gemiddeld zo'n twee maanden nodig, met grote verschillen per persoon [30]. Daarom eerst 3 dagen vast, dan uitbreiden. Je bent er klaar voor als je ${L.READY_WEEKS} weken op rij al je 3 trainingen haalt.</p>
        <div class="dots6" aria-label="${Math.min(cw, L.READY_WEEKS)} van ${L.READY_WEEKS} weken">${Array.from({ length: L.READY_WEEKS }, (_, i) => `<i class="${i < cw ? "on" : ""}"></i>`).join("")}</div>
        <p class="small muted">${ready ? "Klaar! " : `${Math.min(cw, L.READY_WEEKS)} van ${L.READY_WEEKS} weken. `}De vierde dag is bovenlichaam + billen, zodat je billen 3× per week aan de beurt zijn.</p>
        <button class="btn ${ready ? "primary" : "outline"}" data-a="toFour">${ready ? "Voeg de 4e dag toe" : "Toch nu al toevoegen"}</button>`;
    h += `</section>`;
  }
  const topics = COACH.map(([t, x, tag], i) => [t, x, tag, i]).filter(([, , tag]) => !tag || (tag === "glute" && gluteFocus()) || (tag === "female" && P().femaleTopics));
  h += `<section class="card" style="gap:0"><h3 style="margin-bottom:4px">Kennis van je coach</h3>${topics.map(([t, x, , i]) => `<div class="topic"><button data-a="topic" data-i="${i}" aria-expanded="${ui.topic === i}"><span class="grow">${t}</span>${svg(ui.topic === i ? "up" : "down")}</button>${ui.topic === i ? `<p class="small">${x}</p>` : ""}</div>`).join("")}</section>`;
  return h;
}

// ---------- Instellingen (behind the gear) ----------
function renderSettings() {
  const p = P();
  const sw = (label, key, note = "") => toggle(label + (note ? `<br><span class="tiny muted">${note}</span>` : ""), !!p[key], "pref", `data-k="${key}"`);
  const dayNames = ["ma", "di", "wo", "do", "vr", "za", "zo"];
  let h = `<div class="top"><button class="iconbtn" data-a="tab" data-id="${ui.prevTab || "training"}" aria-label="Terug">${svg("back")}</button><h1 class="grow">Instellingen</h1></div>`;

  h += `<span class="label muted grp">Weergave</span><section class="card"><span>Kleurenpalet</span>
    <div class="swatches">${Object.entries(THEMES).map(([k, [label, c]]) => `<button class="swatch-b ${p.theme === k ? "on" : ""}" data-a="theme" data-k="${k}" aria-pressed="${p.theme === k}"><i style="background:${c}"></i><span class="tiny">${label}</span></button>`).join("")}</div></section>`;

  h += `<span class="label muted grp">Tijdens je training</span><section class="card">
    <span>Rusttimer</span><div class="chips wrap">${[["uit", "Uit"], ["af", "Aftellen + trillen"], ["op", "Stil optellen"]].map(([k, l]) => `<button class="chip ${p.rest === k ? "on" : ""}" data-a="restMode" data-k="${k}">${l}</button>`).join("")}</div>
    ${sw("RIR per set bijhouden", "rir", "Hoeveel reps je nog over had. Handig als je dicht op falen traint.")}
    ${sw("Supersets en dropsets", "techniques", "Laat ze instellen in Schema. Staan ze al in je schema, dan blijven ze werken.")}
    ${sw("Vorige keer vooraf invullen", "prefill", "Het gewicht van je coach staat al klaar; anders zie je het alleen als hint.")}
    ${sw("Techniektips standaard open", "tipsOpen")}
    ${sw("Scherm aan houden tijdens training", "wake")}</section>`;

  h += `<span class="label muted grp">Week en cyclus</span><section class="card">
    ${field("Trainingen per week", L.weeklyTarget(data), "target")}
    <p class="tiny muted">Een week telt als 'op schema' bij dit aantal. Zet het eerlijk: een haalbaar doel houdt je reeks in leven.</p>
    <span>Weegdag</span><div class="chips wrap">${dayNames.map((d, i) => `<button class="chip ${p.weighDay === i ? "on" : ""}" data-a="weighDay" data-k="${i}">${d}</button>`).join("")}<button class="chip ${p.weighDay < 0 ? "on" : ""}" data-a="weighDay" data-k="-1">Geen</button></div>
    <div class="field"><span>Start cyclus</span><button data-a="startDate" data-by="-7" aria-label="Week eerder">−</button><b>${L.niceDate(data.program.startDate)}</b><button data-a="startDate" data-by="7" aria-label="Week later">+</button></div>
    <button class="link" data-a="newCycle" style="align-self:flex-start">Nieuwe cyclus starten vanaf deze week</button></section>`;

  h += `<span class="label muted grp">Lichaam</span><section class="card"><span>Omtrek bijhouden</span>
    <div class="chips wrap">${Object.entries(MEASURES).map(([k, l]) => `<button class="chip ${p.measures.includes(k) ? "on" : ""}" data-a="measure" data-k="${k}" aria-pressed="${p.measures.includes(k)}">${l}</button>`).join("")}</div></section>`;

  if (A) {
    const st = ui.healthStatus;
    h += `<span class="label muted grp">Gezondheid</span><section class="card row"><div class="grow"><span>Samsung Health</span><p class="tiny muted">Stappen en gewicht via Health Connect. Alleen lezen, niets verlaat je telefoon.</p></div>
      ${st === "ok" ? `<span class="small accent">Gekoppeld</span>` : st === "unavailable" ? `<span class="small muted">Health Connect ontbreekt</span>` : `<button class="btn outline sm" data-a="healthConnect">Koppelen</button>`}</section>`;
  }

  const legacy = A && legacyText();
  h += `<span class="label muted grp">Je gegevens</span><section class="card">
    <div class="row"><button class="btn outline grow" data-a="export">Back-up maken</button><button class="btn outline grow" data-a="import">Terugzetten</button></div>
    ${legacy ? `<button class="link" data-a="legacyImport" style="align-self:flex-start">Gegevens uit de oude Fitman-app overzetten</button>` : ""}
    <p class="small muted">Je gegevens staan alleen op deze telefoon. Maak af en toe een back-up, bijvoorbeeld naar je cloud of WhatsApp. Terugzetten kan ook met een back-up uit de oude Fitman-, Fitman Max- of Fit Woman-app.</p></section>`;

  const unsent = data.feedback.filter((f) => !f.sent).length;
  h += `<span class="label muted grp">Feedback</span><section class="card"><p class="small muted">Iets dat schuurt of ontbreekt? Noteer het meteen. Bij versturen gaan je schema en het aantal trainingen mee, je gewichten niet.</p>
    <div class="row"><button class="btn outline grow" data-a="feedback">Nieuwe feedback</button><button class="btn primary grow" data-a="sendFeedback" ${data.feedback.length ? "" : "disabled"}>${unsent ? `Verstuur (${unsent})` : "Verstuur alles"}</button></div>
    ${[...data.feedback].reverse().slice(0, 6).map((f) => `<div class="list-row"><div class="grow"><div class="label ${f.sent ? "muted" : "accent"}">${[f.date, f.kind, f.context, f.rating && f.rating + "/5", f.sent && "verstuurd"].filter(Boolean).map(esc).join(" · ")}</div>${f.text ? `<p class="small">${esc(f.text)}</p>` : ""}</div><button class="link muted" data-a="delFeedback" data-id="${f.id}">Wis</button></div>`).join("")}
    ${toggle("Na elke training vragen hoe het ging", !!p.feedback, "pref", 'data-k="feedback"')}</section>`;

  h += `<span class="label muted grp">Over Fitman</span><section class="card"><button class="row" data-a="toggleSrc" style="width:100%"><span class="grow" style="text-align:left">Bronnen (${SOURCES.length})</span>${svg(ui.srcOpen ? "up" : "down").replace("<svg", '<svg width="22" height="22"')}</button>
    ${ui.srcOpen ? SOURCES.map((x, i) => `<div class="src"><b>[${i + 1}]</b><span>${esc(x)}</span></div>`).join("") : ""}
    <p class="tiny muted">Versie ${VERSION}${A ? " · Android" : ""}. Alles blijft op je telefoon; Fitman stuurt niets naar een server.</p></section>`;
  return h;
}

// ---------- welcome: the first start, so nobody lands on an empty app ----------
function legacyText() {
  try { return A?.legacyData?.() || ""; } catch (e) { return ""; }
}
function renderWelcome() {
  const legacy = legacyText();
  let h = `<div class="welcome"><div class="brand">FITMAN</div><h1>Welkom</h1><p class="muted">Je trainingslog met een coach erin. Kies waarmee je begint; alles kun je later aanpassen.</p></div>`;
  if (legacy) h += `<section class="card hl"><h3>Je Fitman-gegevens zijn gevonden</h3><p class="small">Je schema, trainingen, records en metingen uit de vorige versie van de app gaan mee.</p><button class="btn primary block" data-a="legacyImport">Overzetten en verder</button></section>
    <p class="small muted">Of begin opnieuw:</p>`;
  h += `<section class="card"><span>Kleur</span><div class="swatches">${Object.entries(THEMES).map(([k, [label, c]]) => `<button class="swatch-b ${ui.welcomeTheme === k ? "on" : ""}" data-a="welcomeTheme" data-k="${k}" aria-pressed="${ui.welcomeTheme === k}"><i style="background:${c}"></i><span class="tiny">${label}</span></button>`).join("")}</div></section>`;
  h += Object.entries(L.STARTERS).map(([k, v]) => `<button class="card pick" data-a="start" data-k="${k}"><b>${v.label}</b><span class="small muted">${v.text}</span></button>`).join("");
  h += `<button class="card pick" data-a="start" data-k="vragenlijst"><b>Maak een schema op maat</b><span class="small muted">11 korte vragen over je doel, tijd en ervaring. Duurt ongeveer 2 minuten.</span></button>
    <button class="link" data-a="import" style="align-self:center">Ik heb een back-up</button>`;
  return h;
}
function startWith(k) {
  const program = (L.STARTERS[k] || L.STARTERS.fullbody).make();
  const profile = { theme: ui.welcomeTheme };
  if (k === "ppl") Object.assign(profile, { rir: true, techniques: true });
  if (k === "billen") Object.assign(profile, { rir: true, techniques: true, measures: ["hip", "waist"], femaleTopics: true });
  data = normalize({ ...L.emptyData(program), profile });
  save();
  refreshHealth();
  if (k === "vragenlijst") { ui.tab = "schema"; ui.schemaView = "nieuw"; ui.gen = null; }
  else ui.tab = "training";
  render();
}

// ---------- week planner ----------
function planName(plan, id) {
  return L.findDay({ ...data, weekPlans: [plan] }, id)?.name || plan.extraDays.find((e) => e.id === id)?.name || "";
}
function renderPlanner() {
  const thisMon = L.mondayOf(L.today());
  const nextMon = L.addDays(thisMon, 7);
  const active = (data.weekPlans || []).filter((p) => p.monday >= thisMon).sort((a, b) => a.monday.localeCompare(b.monday));
  const p = ui.plan;
  let h = `<section class="card"><h3>Plan je week</h3>`;
  for (const a of active) h += `<div class="stack" style="gap:4px"><span class="label" style="color:var(--done)">${a.monday === thisMon ? "Deze week" : "Volgende week"} · aangepast</span>
    ${a.slots.map((x) => `<div class="row small"><b style="width:28px">${L.dayShort(x.date)}</b><span class="grow">${esc(planName(a, x.dayId))}</span></div>`).join("")}
    <button class="link muted" style="align-self:flex-start" data-a="planClear" data-m="${a.monday}">Planning wissen</button></div>`;
  if (!p) {
    h += `<p class="small muted">Druk week, of kun je op andere dagen dan normaal? Tik aan wanneer je kunt. Ik verdeel je trainingen zo dat er genoeg herstel tussen zit. Kun je minder vaak dan normaal, dan maak ik er combinatietrainingen van.</p>
      <div class="row"><button class="btn outline grow" data-a="planStart" data-m="${thisMon}">Deze week</button><button class="btn outline grow" data-a="planStart" data-m="${nextMon}">Volgende week</button></div></section>`;
    return h;
  }
  const dates = Array.from({ length: 7 }, (_, i) => L.addDays(p.monday, i));
  const trained = new Set(data.sessions.map((s) => s.date));
  h += `<p class="small">Op welke dagen kun je ${p.monday === thisMon ? "deze" : "volgende"} week trainen?</p>
    <div class="chips" style="flex-wrap:wrap">${dates.map((dt) => {
      const past = dt < L.today();
      return `<button class="chip ${p.dates.includes(dt) ? "on" : ""}" ${past ? 'disabled style="opacity:.35"' : ""} data-a="planDay" data-d="${dt}">${L.dayShort(dt)} ${L.parseDate(dt).getDate()}${trained.has(dt) ? " ✓" : ""}</button>`;
    }).join("")}</div>`;
  if (p.result) {
    const r = p.result;
    if (r.slots.length) h += `<div class="stack" style="gap:6px">${r.slots.map((x) => {
      const extra = r.extraDays.find((e) => e.id === x.dayId);
      return `<div><div class="row"><b style="width:28px">${L.dayShort(x.date)}</b><span class="grow">${esc(planName(r, x.dayId))}</span></div>${extra ? `<p class="tiny muted" style="padding-left:36px">${extra.exercises.map((e) => esc(e.name)).join(" · ")}</p>` : ""}</div>`;
    }).join("")}</div>`;
    h += r.notes.map((n) => `<p class="small muted">${esc(n)}</p>`).join("");
    h += `<div class="row"><button class="link muted" data-a="planCancel">Annuleren</button><span class="grow"></span>${r.slots.length ? `<button class="btn primary" data-a="planSave">Gebruik deze planning</button>` : ""}</div>`;
  } else {
    h += `<div class="row"><button class="link muted" data-a="planCancel">Annuleren</button><span class="grow"></span><button class="btn primary" data-a="planMake" ${p.dates.length ? "" : "disabled"}>Maak planning</button></div>`;
  }
  return h + `</section>`;
}

// ---------- feedback ----------
function feedbackSheet(context = "") {
  ui.fbKind = ui.fbKind || "Idee";
  openSheet(() => `<h2>Feedback geven</h2>
    <div class="chips">${["Idee", "Probleem", "Schema", "Training", "Overig"].map((k) => `<button class="chip ${ui.fbKind === k ? "on" : ""}" data-a="fbKind" data-k="${k}">${k}</button>`).join("")}</div>
    <textarea class="text" id="fbText" placeholder="Wat viel je op?"></textarea>
    <div class="actions"><button class="link muted" data-a="close">Annuleren</button><button class="btn primary" data-a="saveFeedback" data-ctx="${esc(context)}">Bewaar</button></div>`);
}

function feedbackReport() {
  const items = data.feedback.filter((f) => !f.sent);
  const list = items.length ? items : data.feedback;
  const lines = [`Fitman feedback · versie ${VERSION} · ${A ? "Android-app" : navigator.userAgent.match(/iPhone OS [\d_]+/)?.[0]?.replace(/_/g, ".") || "browser"} · thema ${P().theme}`,
    `${data.sessions.length} trainingen gelogd sinds ${data.program.startDate}`, ""];
  for (const f of list) lines.push(`• [${[f.date, f.kind, f.context, f.rating && f.rating + "/5"].filter(Boolean).join(" · ")}] ${f.text}`.trim());
  lines.push("", `Schema (${L.weeklyTarget(data)}× per week):`);
  for (const d of data.program.days) lines.push(`${d.name}: ` + d.exercises.map((e) => `${e.name} ${e.sets}×${e.bodyweight ? "AMRAP" : `${e.repMin}-${e.repMax}`}${e.rir != null ? ` @${e.rir} RIR` : ""}${e.dropSets ? ` +${e.dropSets} drop` : ""}${e.supersetWithNext ? " [superset]" : ""}`).join(", "));
  return lines.join("\n");
}

async function shareText(title, text) {
  try {
    if (A?.shareText) { A.shareText(title, text); return true; }
    if (navigator.share) { await navigator.share({ title, text }); return true; }
    await navigator.clipboard.writeText(text);
    toast("Gekopieerd: plak het in WhatsApp");
    return true;
  } catch (e) { return false; }
}

// ---------- backup ----------
async function exportBackup() {
  const json = JSON.stringify({ ...data, draft: null });
  const name = `fitman-backup-${L.today()}.json`;
  if (A?.saveFile) { A.saveFile(name, json); return; }
  const file = new File([json], name, { type: "application/json" });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e.name === "AbortError") return; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function importBackup() {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = "application/json,.json";
  inp.onchange = async () => {
    try {
      restoreFrom(JSON.parse(await inp.files[0].text()));
      toast("Back-up teruggezet");
    } catch (e) { toast("Dit bestand kon niet worden gelezen: " + e.message); }
  };
  inp.click();
}

/** Any backup: Fitman 2, Fit Woman (same model) or the old Android app (Fitman / Fitman Max). */
function restoreFrom(d) {
  if (!d?.program?.days?.length) throw new Error("geen Fitman-back-up");
  const flavor = (() => { try { return A?.flavor?.() || ""; } catch (e) { return ""; } })();
  const next = isKotlinBackup(d) ? fromKotlin(d, flavor) : d.profile ? normalize(d) : fromFitWoman(d);
  // Keep the look someone already chose on this phone.
  if (data && !isKotlinBackup(d) && !d.profile) next.profile.theme = data.profile.theme;
  data = { ...next, draft: null };
  save(); ui.tab = "training"; refreshHealth(); render();
}

// ---------- sheets, toast, confirm ----------
function openSheet(fn) { ui.sheet = fn; renderSheet(); }
function closeSheet() { ui.sheet = null; ui.rating = null; renderSheet(); render(); }
function renderSheet() {
  const el = $("#sheet");
  if (!ui.sheet) { el.hidden = true; el.innerHTML = ""; return; }
  const keep = document.activeElement?.dataset?.in === "pickQ";
  el.hidden = false;
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${ui.sheet()}</div>`;
  if (keep) { const q = el.querySelector('[data-in="pickQ"]'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
}
function confirmSheet(title, text, okLabel, onOk) {
  ui.confirmOk = onOk;
  openSheet(() => `<h2>${title}</h2><p>${text}</p><div class="actions"><button class="link muted" data-a="close">Annuleren</button><button class="btn primary" data-a="confirmOk">${okLabel}</button></div>`);
}
let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), 2600);
}

// ---------- render ----------
function applyTheme() {
  const t = data?.profile.theme || ui.welcomeTheme;
  document.documentElement.dataset.theme = t;
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
  try { A?.setTheme?.(bg, t === "wit"); } catch (e) { /* older app */ }
}

/** Keep the screen on while training, so the phone does not lock between sets. */
let wakeLock = null;
async function syncWake() {
  const want = !!(data && P().wake && ui.tab === "training" && !document.hidden);
  try { if (A?.keepScreenOn) { A.keepScreenOn(want); return; } } catch (e) { /* fall through */ }
  try {
    if (want && !wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); }
    else if (!want && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { wakeLock = null; }
}

function render() {
  const main = $("main");
  const y = window.scrollY;
  applyTheme();
  if (!data) {
    main.dataset.tab = "welcome";
    main.innerHTML = renderWelcome();
    $("nav.tabs").hidden = true;
    if (ui.sheet) renderSheet();
    return;
  }
  const tabChanged = main.dataset.tab !== ui.tab;
  main.dataset.tab = ui.tab;
  main.innerHTML = { training: renderTraining, schema: renderSchema, progress: renderProgress, coach: renderCoach, settings: renderSettings }[ui.tab]();
  $("nav.tabs").hidden = ui.tab === "settings";
  $("nav.tabs").innerHTML = TABS.map(([id, label, icon]) => `<button class="${ui.tab === id ? "on" : ""}" data-a="tab" data-id="${id}" aria-current="${ui.tab === id ? "page" : "false"}">${svg(icon)}${label}</button>`).join("");
  syncWake();
  if (!tabChanged) window.scrollTo(0, y); else window.scrollTo(0, 0);
  renderTimer();
  if (ui.sheet) renderSheet();
}

// ---------- events ----------
const actions = {
  tab: (t) => { if (t.dataset.id === "settings" && ui.tab !== "settings") ui.prevTab = ui.tab; ui.tab = t.dataset.id; render(); },
  tipToggle: (t) => { const id = t.dataset.id; ui.tip[id] = !(ui.tip[id] ?? P().tipsOpen); render(); },
  theme: (t) => update((d) => ({ ...d, profile: { ...d.profile, theme: t.dataset.k } })),
  restMode: (t) => { ui.restStart = 0; update((d) => ({ ...d, profile: { ...d.profile, rest: t.dataset.k } })); },
  pref: (t) => {
    const k = t.dataset.k;
    update((d) => ({ ...d, profile: { ...d.profile, [k]: !d.profile[k] } }));
    // Prefill decides how today's sets start; rebuild an untouched draft so the switch shows at once.
    if (k === "prefill" && data.draft && !Object.values(data.draft.items).flat().some((x) => x.done)) { data.draft = null; save(); }
  },
  weighDay: (t) => update((d) => ({ ...d, profile: { ...d.profile, weighDay: +t.dataset.k } })),
  measure: (t) => { const k = t.dataset.k; update((d) => ({ ...d, profile: { ...d.profile, measures: d.profile.measures.includes(k) ? d.profile.measures.filter((x) => x !== k) : [...d.profile.measures, k] } })); },
  welcomeTheme: (t) => { ui.welcomeTheme = t.dataset.k; render(); },
  start: (t) => startWith(t.dataset.k),
  legacyImport: () => {
    const go = () => { try { restoreFrom(JSON.parse(legacyText())); toast("Je gegevens zijn overgezet"); } catch (e) { toast("Overzetten lukte niet: " + e.message); } };
    if (data) confirmSheet("Oude gegevens overzetten?", "Wat nu in Fitman staat wordt vervangen door je gegevens uit de oude app. Maak eerst een back-up als je twijfelt.", "Overzetten", go); else go();
  },
  day: (t) => {
    const dr = currentDraft();
    const id = t.dataset.id;
    if (id === dr.dayId) return;
    const go = () => { ui.openEx = null; update((d) => ({ ...d, draft: L.freshDraft(d, id) })); };
    if (Object.values(dr.items).flat().some((s) => s.done)) confirmSheet("Van dag wisselen?", "Je hebt vandaag al sets afgevinkt. Als je wisselt, worden die niet bewaard.", "Wissel en wis sets", go);
    else go();
  },
  openEx: (t) => { const dr = currentDraft(); const day = L.findDayNow(data, dr.dayId); const cur = ui.openEx ?? day.exercises.find((e) => dr.items[e.id]?.some((s) => !s.done))?.id; ui.openEx = cur === t.dataset.id ? "" : t.dataset.id; render(); },
  shuffle: (t) => {
    const dr = currentDraft();
    const day = L.findDayNow(data, dr.dayId);
    const slot = day.exercises.find((e) => e.id === t.dataset.id);
    const shownId = dr.swaps[slot.id] || slot.id;
    const shown = L.exercise(data, shownId) || slot;
    const inUse = new Set([...day.exercises.map((e) => e.id), ...Object.values(dr.swaps), shownId]);
    const options = [...L.alternatives(data, shown, inUse), ...(shownId !== slot.id ? [slot] : [])];
    if (!options.length) return toast("Geen alternatief gevonden");
    const pick = options[Math.floor(Math.random() * options.length)];
    const swaps = { ...dr.swaps };
    if (pick.id === slot.id) delete swaps[slot.id]; else swaps[slot.id] = pick.id;
    ui.openEx = slot.id;
    update((d) => ({ ...d, draft: { ...dr, swaps, items: { ...dr.items, [slot.id]: L.draftSets(d, pick, slot.sets, slot.dropSets) } } }));
  },
  kgStep: (t) => {
    const dr = currentDraft(); const day = L.findDayNow(data, dr.dayId);
    const slot = day.exercises.find((e) => e.id === t.dataset.id);
    const e = (dr.swaps[slot.id] && L.exercise(data, dr.swaps[slot.id])) || slot;
    editSet(slot.id, +t.dataset.i, (s) => ({ ...s, kg: L.fmt(Math.max(0, L.round1(L.toKg(s.kg || s.hint) + +t.dataset.by * e.inc))) })); render();
  },
  repStep: (t) => { editSet(t.dataset.id, +t.dataset.i, (s) => ({ ...s, reps: String(Math.max(0, (parseInt(s.reps, 10) || s.goal || 0) + +t.dataset.by)) })); render(); },
  rir: (t) => { const n = +t.dataset.n; editSet(t.dataset.id, +t.dataset.i, (s) => ({ ...s, rir: s.rir === n ? null : n })); render(); },
  done: (t) => markDone(t.dataset.id, +t.dataset.i, +t.dataset.idx),
  finish: () => finishTraining(),
  rate: (t) => { ui.rating = +t.dataset.n; const txt = $("#rateText")?.value; renderSheet(); if (txt) $("#rateText").value = txt; },
  saveRating: (t) => {
    const text = ($("#rateText")?.value || "").trim();
    if (ui.rating || text) update((d) => ({ ...d, feedback: [...d.feedback, { id: "f" + Date.now(), date: L.today(), kind: "Training", text, rating: ui.rating, context: t.dataset.ctx, sent: false }] }));
    closeSheet();
  },
  restStop: () => { ui.restStart = 0; renderTimer(); },

  sDay: (t) => { ui.schemaDay = t.dataset.id; ui.schemaEx = null; render(); },
  addDay: () => { const id = "d" + Date.now(); editProgram((p) => L.addDay(p, id)); ui.schemaDay = id; render(); },
  moveDay: (t) => editProgram((p) => L.moveDay(p, ui.schemaDay, +t.dataset.by)),
  copyDay: () => { const id = "d" + Date.now(); editProgram((p) => L.duplicateDay(p, ui.schemaDay, id)); ui.schemaDay = id; render(); },
  renameDay: () => {
    const day = data.program.days.find((x) => x.id === ui.schemaDay);
    openSheet(() => `<h2>Naam van de dag</h2><input class="text" id="dayName" value="${esc(day.name)}" maxlength="24"><div class="actions"><button class="link muted" data-a="close">Annuleren</button><button class="btn primary" data-a="saveDayName">Bewaar</button></div>`);
    setTimeout(() => $("#dayName")?.select(), 50);
  },
  saveDayName: () => { const n = $("#dayName").value.trim(); if (n) editProgram((p) => L.updateDay(p, ui.schemaDay, (x) => ({ ...x, name: n }))); closeSheet(); },
  delDay: () => {
    const day = data.program.days.find((x) => x.id === ui.schemaDay);
    confirmSheet(`${esc(day.name)} verwijderen?`, "De dag en zijn oefeningen gaan uit je schema. Trainingen die je al gelogd hebt blijven bewaard.", "Verwijderen", () => { editProgram((p) => L.removeDay(p, day.id)); ui.schemaDay = null; render(); });
  },
  sEx: (t) => { ui.schemaEx = ui.schemaEx === t.dataset.id ? null : t.dataset.id; render(); },
  exSuper: (t) => editProgram((p) => L.updateExercise(p, ui.schemaDay, t.dataset.id, (e) => ({ ...e, supersetWithNext: !e.supersetWithNext }))),
  exMove: (t) => editProgram((p) => L.moveExercise(p, ui.schemaDay, t.dataset.id, +t.dataset.by)),
  exRemove: (t) => { ui.schemaEx = null; editProgram((p) => L.removeExercise(p, ui.schemaDay, t.dataset.id)); },
  exReplace: (t) => pickerSheet(t.dataset.id),
  addEx: () => pickerSheet(null),
  pickM: (t) => { ui.pick.muscle = t.dataset.m; renderSheet(); },
  pickEx: (t) => placeExercise(L.exercise(data, t.dataset.id)),
  createEx: () => {
    const name = $("#newName").value.trim();
    if (!name) return toast("Geef je oefening een naam");
    const m = $("#newMuscle").value;
    const e = { id: "c" + Date.now(), name, cue: "", sets: 3, repMin: 8, repMax: 12, inc: 2.5, bodyweight: false, muscles: { [m]: 1 }, rest: 90, tip: "", src: [], rir: 1, dropSets: 0, supersetWithNext: false };
    data.customExercises = [...data.customExercises, e];
    placeExercise(e);
  },
  target: (t) => editProgram((p) => ({ ...p, weeklyTarget: Math.min(7, Math.max(1, L.weeklyTarget(data) + +t.dataset.by)) })),
  reset: () => openSheet(() => `<h2>Terug naar een startschema</h2><p class="small muted">Je huidige schema wordt eerst bewaard in Mijn schema's. Gelogde trainingen en je startdatum blijven staan.</p>
    ${Object.entries(L.STARTERS).map(([k, v]) => `<button class="list-row" style="width:100%;text-align:left" data-a="resetTo" data-k="${k}"><span class="grow"><b>${v.label}</b><br><span class="small muted">${v.text}</span></span></button>`).join("")}
    <div class="actions"><button class="link muted" data-a="close">Annuleren</button></div>`),
  resetTo: (t) => { const p = L.STARTERS[t.dataset.k].make(); closeSheet(); update((d) => useProgram(d, p)); ui.schemaDay = null; render(); toast("Startschema staat klaar"); },
  buildUp: () => editProgram((p) => ({ ...p, buildUp: !p.buildUp })),

  addWeight: () => {
    const date = $("#wDate").value || L.today();
    const vals = { kg: L.toKg($("#wKg").value) };
    for (const m of Object.keys(MEASURES)) { const el = $("#w_" + m); if (el) vals[m] = L.toKg(el.value); }
    if (!Object.values(vals).some(Boolean)) return toast("Vul minstens één waarde in");
    closeSheet();
    update((d) => {
      const old = d.weights.find((x) => x.date === date) || {};
      const entry = { ...old, date, ...Object.fromEntries(Object.entries(vals).filter(([, v]) => v)) };
      return { ...d, weights: [...d.weights.filter((x) => x.date !== date), entry] };
    });
    toast("Meting bewaard");
  },
  measureSheet: (t) => measureSheet(t.dataset.only === "kg"),
  measurePick: (t) => { ui.measure = t.dataset.k; render(); },
  progView: (t) => { ui.progView = t.dataset.id; render(); },
  healthConnect: () => { try { A?.requestHealth(); } catch (e) { toast("Health Connect kon niet worden geopend"); } },
  delWeight: (t) => update((d) => ({ ...d, weights: d.weights.filter((x) => x.date !== t.dataset.date) })),

  toFour: () => confirmSheet("Naar 4 dagen per week?", "Ik voeg de dag 'Bovenlichaam + billen' toe en zet je weekdoel op 4. Je kunt hem daarna in Schema aanpassen of hier weer weghalen.", "Voeg toe",
    () => { update((d) => ({ ...d, program: L.expandToFour(d.program), draft: null })); toast("Vierde dag toegevoegd"); }),
  toThree: () => confirmSheet("Terug naar 3 dagen?", "De vierde dag gaat uit je schema en je weekdoel wordt 3. Gelogde trainingen blijven bewaard.", "Terug naar 3",
    () => update((d) => ({ ...d, program: L.backToThree(d.program), draft: null }))),
  feedback: () => feedbackSheet(""),
  fbKind: (t) => { const txt = $("#fbText")?.value; ui.fbKind = t.dataset.k; renderSheet(); if (txt) $("#fbText").value = txt; },
  saveFeedback: (t) => {
    const text = $("#fbText").value.trim();
    if (!text) return toast("Schrijf eerst iets op");
    update((d) => ({ ...d, feedback: [...d.feedback, { id: "f" + Date.now(), date: L.today(), kind: ui.fbKind, text, rating: null, context: t.dataset.ctx || "", sent: false }] }));
    closeSheet(); toast("Feedback bewaard");
  },
  sendFeedback: async () => { if (await shareText("Fitman feedback", feedbackReport())) update((d) => ({ ...d, feedback: d.feedback.map((f) => ({ ...f, sent: true })) })); },
  delFeedback: (t) => update((d) => ({ ...d, feedback: d.feedback.filter((f) => f.id !== t.dataset.id) })),
  startDate: (t) => editProgram((p) => ({ ...p, startDate: L.addDays(p.startDate, +t.dataset.by) })),
  newCycle: () => confirmSheet("Nieuwe cyclus starten?", "Je cyclus van 12 weken begint opnieuw vanaf maandag deze week. Je schema, trainingen en records blijven bewaard.", "Start",
    () => editProgram((p) => ({ ...p, startDate: L.mondayOf(L.today()) }))),
  export: () => exportBackup(),
  import: () => importBackup(),
  topic: (t) => { ui.topic = ui.topic === +t.dataset.i ? null : +t.dataset.i; render(); },
  planStart: (t) => { ui.plan = { monday: t.dataset.m, dates: [], result: null }; render(); },
  planDay: (t) => { const d = t.dataset.d; const ds = ui.plan.dates; ui.plan = { ...ui.plan, result: null, dates: ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d] }; render(); },
  planMake: () => { ui.plan = { ...ui.plan, result: L.planWeek(data, ui.plan.monday, ui.plan.dates) }; render(); },
  planCancel: () => { ui.plan = null; render(); },
  planSave: () => {
    const r = ui.plan.result;
    ui.plan = null;
    update((d) => {
      const keepDraft = d.draft && d.draft.date === L.today() && Object.values(d.draft.items).flat().some((s) => s.done);
      return { ...d, weekPlans: [...(d.weekPlans || []).filter((x) => x.monday !== r.monday), { monday: r.monday, slots: r.slots, extraDays: r.extraDays }], draft: keepDraft ? d.draft : null };
    });
    toast("Planning opgeslagen");
  },
  planClear: (t) => confirmSheet("Planning wissen?", "Je gaat terug naar je normale schema voor die week.", "Wissen",
    () => update((d) => ({ ...d, weekPlans: (d.weekPlans || []).filter((x) => x.monday !== t.dataset.m), draft: null }))),
  toggleSrc: () => { ui.srcOpen = !ui.srcOpen; render(); },
  close: () => closeSheet(),
  confirmOk: () => { const f = ui.confirmOk; ui.confirmOk = null; ui.sheet = null; renderSheet(); f?.(); },
};

document.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-a]");
  if (t && !t.disabled) actions[t.dataset.a]?.(t);
  else if (ev.target.id === "sheet") closeSheet();
});

document.addEventListener("change", (ev) => {
  const t = ev.target;
  const k = t.dataset.in;
  if (k === "kg") { editSet(t.dataset.id, +t.dataset.i, (s) => ({ ...s, kg: t.value.replace(/[^\d.,]/g, "") })); }
  else if (k === "reps") { editSet(t.dataset.id, +t.dataset.i, (s) => ({ ...s, reps: t.value.replace(/\D/g, "") })); }
  else if (k === "cue") editProgram((p) => L.updateExercise(p, ui.schemaDay, t.dataset.id, (e) => ({ ...e, cue: t.value.trim() })));
  else if (k === "progEx") { ui.progressEx = t.value; render(); }
});
document.addEventListener("input", (ev) => {
  if (ev.target.dataset.in === "pickQ") { ui.pick.q = ev.target.value; renderSheet(); }
});

Object.assign(actions, genActions);

// Schema stepper buttons share one handler per field.
for (const k of Object.keys(clampEx)) actions[k] = (t) => editProgram((p) => L.updateExercise(p, ui.schemaDay, t.dataset.id, (e) => clampEx[k](e, +t.dataset.by)));

// A new day: today's draft may be stale.
document.addEventListener("visibilitychange", () => { if (!document.hidden) { if (data) refreshHealth(); render(); } else syncWake(); });

/** Android back button: close a sheet, leave settings, go back to Training; false lets the app close. */
window.fitmanBack = () => {
  if (ui.sheet) { closeSheet(); return true; }
  if (!data) return false;
  if (ui.tab === "settings") { ui.tab = ui.prevTab || "training"; render(); return true; }
  if (ui.tab !== "training") { ui.tab = "training"; render(); return true; }
  return false;
};

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
if (data) refreshHealth();
render();
