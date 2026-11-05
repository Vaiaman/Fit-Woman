// Fit Woman: the screens. State lives in localStorage on her phone; nothing leaves the device
// unless she shares a backup or feedback herself.
import { LIBRARY, SOURCES } from "./library.js";
import * as L from "./logic.js";

const KEY = "fitwoman.v1";
const VERSION = "1.1";
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- state ----------
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return L.emptyData();
    const d = { ...L.emptyData(), ...JSON.parse(raw) };
    d.weekPlans = d.weekPlans || [];
    d.settings = { restTimer: false, ...(d.settings || {}) };
    return d;
  } catch (e) {
    localStorage.setItem(KEY + ".unreadable." + Date.now(), localStorage.getItem(KEY) || "");
    return L.emptyData();
  }
}
let data = load();
const ui = { tab: "training", openEx: null, schemaDay: null, schemaEx: null, progressEx: null, sheet: null, restStart: 0, restAdvice: 0, plan: null };

function save() { localStorage.setItem(KEY, JSON.stringify(data)); }
function update(f) { data = f(data); save(); render(); }
function editProgram(f) { update((d) => ({ ...d, program: f(d.program) })); }

// Ask Safari to keep the data; a web app on the home screen is also exempt from the 7-day storage cap.
navigator.storage?.persist?.();

// ---------- icons ----------
const I = {
  home: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="currentColor"/>',
  edit: '<path d="M4 17.2V20h2.8l8.3-8.3-2.8-2.8zM19.7 7.3a1 1 0 0 0 0-1.4l-1.6-1.6a1 1 0 0 0-1.4 0l-1.3 1.3 2.8 2.8z" fill="currentColor"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="currentColor"/>',
  heart: '<path d="M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.7 3.9 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.6 3.2 4.4 6.7-1.7 4.7-9.2 9.3-9.2 9.3z" fill="currentColor"/>',
  coach: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 10.5v6M12 7.2v.1" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  shuffle: '<path d="M16 4h4v4M4 20 20 4M20 16v4h-4M15 15l5 5M4 4l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  up: '<path d="m6 15 6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  down: '<path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${I[name]}</svg>`;

const TABS = [
  ["training", "Training", "home"],
  ["schema", "Schema", "edit"],
  ["progress", "Progressie", "star"],
  ["body", "Lichaam", "heart"],
  ["coach", "Coach", "coach"],
];

// ---------- small building blocks ----------
const srcText = (src) => (src?.length ? "Bron " + src.map((n) => `[${n}]`).join(", ") + " · zie Coach" : "Praktijktip");
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
  const keys = Object.keys(L.MUSCLES).filter((m) => (sets[m] || 0) > 0 || !["kuiten", "buikspieren", "schouders-voor"].includes(m));
  return keys.map((m) => {
    const v = sets[m] || 0;
    return `<div class="vol ${m === "bilspieren" ? "glute" : ""}"><span>${L.MUSCLES[m]}</span><div class="track"><div class="band"></div><div class="fill" style="width:${(Math.min(v, 24) / 24) * 100}%"></div></div><b class="end">${L.fmt(v)}</b></div>`;
  }).join("");
}

// ---------- Training ----------
function currentDraft() {
  let dr = data.draft && data.draft.date === L.today() ? L.reconcile(data, data.draft) : L.freshDraft(data, L.nextDayId(data));
  if (dr !== data.draft) { data.draft = dr; save(); }
  return dr;
}

function renderTraining() {
  const dr = currentDraft();
  const day = L.findDay(data, dr.dayId);
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

  let h = `<div class="top"><h1 class="grow">FIT <span>WOMAN</span></h1>
    <div class="end"><button class="link" data-a="feedback">Feedback geven</button><div class="small muted">${w > 12 ? "Cyclus afgerond" : `Week ${w} van 12`}</div></div></div>
    <div class="cyclebar" aria-label="Cyclus"><div style="width:${Math.min(100, (L.inCycle(data).length / L.cycleSessions(data)) * 100)}%"></div></div>
    <div class="row small"><span class="muted grow">Deze week</span><span class="weekdots">${Array.from({ length: target }, (_, i) => `<i class="${i < thisWeek ? "on" : ""}"></i>`).join("")}</span><span>${Math.min(thisWeek, target)}/${target}</span></div>
    ${plan ? `<p class="small accent">Je weekplanning staat aan. Aanpassen of wissen doe je in Coach.</p>` : ""}
    <div class="seg" role="tablist">${toggles.map((t) => `<button class="${t.id === dr.dayId ? "on" : ""}" data-a="day" data-id="${t.id}">${esc(t.label)}</button>`).join("")}</div>
    <p class="small muted">Geschatte duur ± ${L.estimatedMinutes(day)} min, inclusief rust en warming-up.</p>`;

  if (!day.exercises.length) h += `<div class="empty">${esc(day.name)} heeft nog geen oefeningen. Voeg ze toe in Schema.</div>`;

  day.exercises.forEach((slot, idx) => {
    const e = (dr.swaps[slot.id] && L.exercise(data, dr.swaps[slot.id])) || slot;
    const sets = dr.items[slot.id] || [];
    const done = sets.filter((s) => s.done).length;
    const isOpen = open === slot.id;
    const sub = [
      slot.rir != null ? `doel ${slot.rir} RIR` : null,
      slot.dropSets ? `+ ${slot.dropSets} ${slot.dropSets === 1 ? "dropset" : "dropsets"}` : null,
      e.id === slot.id && slot.cue ? esc(slot.cue) : null,
      e.id !== slot.id ? `vervangt ${esc(slot.name)}` : null,
    ].filter(Boolean).join(" · ");
    h += `<section class="card">
      <div class="ex-head">
        <button class="grow" style="text-align:left" data-a="openEx" data-id="${slot.id}" aria-expanded="${isOpen}">
          ${groups[idx] ? `<div class="label" style="color:var(--done)">Superset ${groups[idx]}</div>` : ""}
          <h3>${esc(e.name)} ${L.isGlute(e) ? '<span class="pill glute">bil</span>' : ""}</h3>
          ${sub ? `<div class="small ${e.id !== slot.id ? "accent" : "muted"}">${sub}</div>` : ""}
        </button>
        <button class="iconbtn" data-a="shuffle" data-id="${slot.id}" ${sets.some((s) => s.done) ? "disabled" : ""} aria-label="Andere oefening voor dezelfde spier">${svg("shuffle")}</button>
        <div class="meta"><b>${sets.filter((s) => !s.drop).length} × ${e.bodyweight ? "AMRAP" : `${e.repMin}–${e.repMax}`}</b><span class="small" style="color:${done === sets.length && sets.length ? "var(--done)" : "var(--muted)"}">${done}/${sets.length} sets</span></div>
      </div>
      ${sets.some((s) => s.pr) ? '<div><span class="pill record">Persoonlijk record</span></div>' : ""}`;
    if (isOpen) {
      const sg = L.suggestion(data, e);
      const last = L.lastFor(data, e.id, L.today());
      if (e.tip) h += `<div class="tip">${esc(e.tip)}<div class="tiny">${srcText(e.src)}</div></div>`;
      h += `<p class="small accent">Doel vandaag: ${esc(sg.text)}</p><p class="small muted">Rust ${restText(e.rest)} tussen sets</p>`;
      sets.forEach((s, i) => {
        const p = !s.drop && last?.sets[i];
        h += `<div class="stack" style="gap:4px">
          <div class="setrow">
            <span class="setno ${s.drop ? "drop" : ""}">${s.drop ? "D" : i + 1}</span>
            <div class="stepper ${s.done ? "done" : ""}"><button data-a="kgStep" data-id="${slot.id}" data-i="${i}" data-by="-1" aria-label="Minder kg">−</button><input inputmode="decimal" data-in="kg" data-id="${slot.id}" data-i="${i}" value="${esc(s.kg)}" placeholder="–" aria-label="Kilo set ${i + 1}"><span class="unit">${e.bodyweight ? "+kg" : "kg"}</span><button data-a="kgStep" data-id="${slot.id}" data-i="${i}" data-by="1" aria-label="Meer kg">+</button></div>
            <div class="stepper ${s.done ? "done" : ""}"><button data-a="repStep" data-id="${slot.id}" data-i="${i}" data-by="-1" aria-label="Minder reps">−</button><input inputmode="numeric" data-in="reps" data-id="${slot.id}" data-i="${i}" value="${esc(s.reps)}" placeholder="${s.goal ?? "–"}" aria-label="Reps set ${i + 1}"><span class="unit">reps</span><button data-a="repStep" data-id="${slot.id}" data-i="${i}" data-by="1" aria-label="Meer reps">+</button></div>
            <button class="check ${s.done ? "on" : ""}" data-a="done" data-id="${slot.id}" data-i="${i}" data-idx="${idx}" aria-label="Set ${i + 1} klaar">${svg("check")}</button>
          </div>
          ${s.drop ? "" : `<div class="rir"><span>RIR</span>${[0, 1, 2, 3, 4].map((n) => `<button class="${s.rir === n ? "on" : ""} ${slot.rir === n ? "target" : ""}" data-a="rir" data-id="${slot.id}" data-i="${i}" data-n="${n}">${n === 4 ? "4+" : n}</button>`).join("")}</div>`}
          ${p ? `<div class="prev">Vorige keer ${L.fmt(p.kg)} kg × ${p.reps}${p.rir != null ? ` · ${p.rir} RIR` : ""}${s.goal ? ` · doel ${s.goal}` : ""}</div>` : ""}
        </div>`;
      });
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
  const day = L.findDay(data, dr.dayId);
  const slot = day.exercises[idx];
  const e = (dr.swaps[slotId] && L.exercise(data, dr.swaps[slotId])) || slot;
  const s = dr.items[slotId][i];
  if (s.done) { editSet(slotId, i, (x) => ({ ...x, done: false, pr: false })); return render(); }
  const reps = parseInt(s.reps, 10) || s.goal;
  if (!reps) { toast("Vul eerst je reps in"); return; }
  const kg = L.toKg(s.kg);
  const best = L.bestScore(data, e, L.today());
  const pr = best > 0 && L.setScore(e, { kg, reps }) > best;
  editSet(slotId, i, (x) => ({ ...x, done: true, reps: String(reps), kg: L.fmt(kg), pr }));
  if (pr) toast("Persoonlijk record!");
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
  const day = L.findDay(data, dr.dayId);
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
    <h3>Hoe ging het?</h3>
    <div class="stars">${[1, 2, 3, 4, 5].map((r) => `<button data-a="rate" data-n="${r}" class="${ui.rating === r ? "on" : ""}">${r}</button>`).join("")}</div>
    <textarea class="text" id="rateText" placeholder="Optioneel: wat viel op? (zwaar, pijntje, machine bezet …)"></textarea>
    <div class="actions"><button class="link muted" data-a="close">Sluiten</button><button class="btn primary" data-a="saveRating" data-ctx="${esc(day.name)}">Bewaar</button></div>`);
}

// ---------- rest timer ----------
// No countdown and no sound (her feedback: a ticking clock is stressful). When she turns the
// timer on in Coach, it counts up quietly and only shows the advised rest as a reference.
function startRest(sec) {
  if (!data.settings?.restTimer) return;
  ui.restAdvice = sec; ui.restStart = Date.now();
}
function renderTimer() {
  const el = $("#timer");
  if (!ui.restStart) { el.hidden = true; $("main").classList.remove("timer-on"); return; }
  const gone = Math.floor((Date.now() - ui.restStart) / 1000);
  el.hidden = false; $("main").classList.add("timer-on");
  el.innerHTML = `<div class="grow"><div class="label muted">Rust</div><div class="small ${gone >= ui.restAdvice ? "accent" : "muted"}">${gone >= ui.restAdvice ? "Klaar wanneer jij bent" : `advies ${restText(ui.restAdvice)}`}</div></div>
    <b>${restText(gone)}</b><button class="link" data-a="restStop">Verberg</button>`;
}
setInterval(() => { if (ui.restStart) renderTimer(); }, 1000);

// ---------- Schema ----------
function renderSchema() {
  const p = data.program;
  const day = p.days.find((x) => x.id === ui.schemaDay) || p.days[0];
  ui.schemaDay = day.id;
  const groups = L.supersetLabels(day.exercises);
  let h = `<h2>Schema</h2><p class="small muted">Jouw week, jouw keuzes. Tik op een oefening om sets, reps, rust en stapgrootte aan te passen. Alles wordt meteen bewaard.</p>
    <div class="chips">${p.days.map((d) => `<button class="chip ${d.id === day.id ? "on" : ""}" data-a="sDay" data-id="${d.id}">${esc(d.name)}</button>`).join("")}${p.days.length < 7 ? `<button class="chip add" data-a="addDay">+ Dag</button>` : ""}</div>
    <section class="card"><div class="row"><div class="grow"><h2 style="margin:0">${esc(day.name)}</h2><p class="small muted">${day.exercises.length} oefeningen · ${day.exercises.reduce((a, e) => a + e.sets, 0)} sets · ± ${L.estimatedMinutes(day)} min</p></div>
      <button class="iconbtn" data-a="moveDay" data-by="-1" aria-label="Dag naar voren">${svg("up")}</button><button class="iconbtn" data-a="moveDay" data-by="1" aria-label="Dag naar achteren">${svg("down")}</button></div>
      <div class="row"><button class="link" data-a="renameDay">Naam wijzigen</button><button class="link" data-a="copyDay">Kopiëren</button>${p.days.length > 1 ? `<button class="link warn" data-a="delDay">Verwijderen</button>` : ""}</div></section>`;
  if (!day.exercises.length) h += `<div class="empty">Nog geen oefeningen op ${esc(day.name)}. Voeg hieronder je eerste oefening toe.</div>`;
  day.exercises.forEach((e, i) => {
    const open = ui.schemaEx === e.id;
    h += `<section class="card"><button class="ex-head" data-a="sEx" data-id="${e.id}" aria-expanded="${open}">
      <div class="grow">${groups[i] ? `<div class="label" style="color:var(--done)">Superset ${groups[i]}</div>` : ""}<h3>${esc(e.name)} ${L.isGlute(e) ? '<span class="pill glute">bil</span>' : ""}</h3>
      <div class="small muted">${e.sets} × ${e.bodyweight ? "AMRAP" : `${e.repMin}–${e.repMax}`}${e.rir != null ? ` · ${e.rir} RIR` : ""}${e.dropSets ? ` · +${e.dropSets} drop` : ""} · rust ${restText(e.rest)}</div></div></button>`;
    if (open) {
      const x = `data-id="${e.id}"`;
      h += field("Sets", e.sets, "exSets", x)
        + (e.bodyweight ? "" : field("Reps minimaal", e.repMin, "exMin", x) + field("Reps maximaal", e.repMax, "exMax", x))
        + field("Rust", restText(e.rest), "exRest", x)
        + field("Gewichtsstap", L.fmt(e.inc) + " kg", "exInc", x)
        + field("Doel-RIR", e.rir ?? "–", "exRir", x)
        + field("Dropsets", e.dropSets, "exDrops", x)
        + (i < day.exercises.length - 1 ? toggle(`Superset met ${esc(day.exercises[i + 1].name)}`, e.supersetWithNext, "exSuper", x) : "")
        + `<input class="text" data-in="cue" ${x} value="${esc(e.cue)}" placeholder="Notitie, bijvoorbeeld stoelstand 4" maxlength="60">
        <div class="row"><button class="iconbtn" data-a="exMove" data-by="-1" ${x} aria-label="Omhoog">${svg("up")}</button><button class="iconbtn" data-a="exMove" data-by="1" ${x} aria-label="Omlaag">${svg("down")}</button>
        <span class="grow"></span><button class="link" data-a="exReplace" ${x}>Vervangen</button><button class="link warn" data-a="exRemove" ${x}>Weg</button></div>`;
    }
    h += `</section>`;
  });
  const sets = L.muscleSets(p);
  h += `<button class="btn outline block" data-a="addEx">+ Oefening toevoegen</button>
    <section class="card"><h3>Sets per spiergroep per week</h3><p class="small muted">Telt al je dagen samen. Directe sets tellen als 1, meehelpende als 0,5. Het paarse vlak is 10–20 sets, een praktische werkrange [4, 5]. Voor je billen mag je bovenin zitten.</p>${volumeBars(sets)}</section>
    <section class="card"><h3>Weekdoel</h3>${field("Trainingen per week", L.weeklyTarget(data), "target")}
      <p class="small muted">Een week telt als 'op schema' bij dit aantal trainingen. Zet het eerlijk: een haalbaar doel houdt je reeks in leven.</p></section>
    <button class="link muted" data-a="reset">Terug naar het startschema</button>`;
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

// ---------- Progress ----------
function renderProgress() {
  const w = Math.min(L.currentWeek(data), 12);
  const stats = L.weekStats(data);
  const st = L.streak(data);
  const target = L.weeklyTarget(data);
  const tracked = L.trackedExercises(data);
  const ex = tracked.find((e) => e.id === ui.progressEx) || tracked[0];
  ui.progressEx = ex?.id;
  const series = ex ? L.exerciseSeries(data, ex) : [];
  const max = Math.max(target, ...stats.map((s) => Math.max(s.sessions, s.target)));
  let h = `<h2>Progressie</h2>
    <div class="tiles">
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
      <p class="small muted">Paars is een week waarin je je weekdoel haalde (bij een aangepaste week: je planning). Eén gemiste week per cyclus breekt je reeks niet.</p></section>`;
  if (ex) h += `<section class="card"><h3>Per oefening</h3>
      <select class="text" data-in="progEx">${tracked.map((e) => `<option value="${e.id}" ${e.id === ex.id ? "selected" : ""}>${esc(e.name)}</option>`).join("")}</select>
      ${series.length ? lineChart(series.map((p) => ({ v: p.value, record: p.record })), "var(--accent)") : '<div class="empty">Nog niet gelogd deze cyclus.</div>'}
      ${series.length ? `<p class="small muted">Laatst: ${L.fmt(series.at(-1).top.kg)} kg × ${series.at(-1).top.reps}. Gouden punten zijn records. ${ex.bodyweight ? "Lijn = totaal reps." : "Lijn = geschat 1RM (Epley)."}</p>` : ""}</section>`;
  h += `<section class="card"><h3>Sets per spiergroep per week</h3>${volumeBars(L.muscleSets(data.program))}</section>`;
  return h;
}

// ---------- Body ----------
function renderBody() {
  const ws = [...data.weights].sort((a, b) => a.date.localeCompare(b.date));
  const lastM = [...ws].reverse().find((x) => x.hip || x.waist);
  let h = `<h2>Lichaam</h2>
    <section class="card"><h3>Meting toevoegen</h3>
      <p class="small muted">Weeg jezelf één keer per week, op hetzelfde moment (bijvoorbeeld maandagochtend na het opstaan). De weegschaal zegt weinig over je billen: meet daarom elke 2–4 weken ook je billen- en taille-omtrek.</p>
      <div class="row"><input class="text" id="wDate" type="date" value="${L.today()}" style="flex:1.3"><input class="text" id="wKg" inputmode="decimal" placeholder="kg" style="flex:1"></div>
      <div class="row"><input class="text" id="wHip" inputmode="decimal" placeholder="billen cm"><input class="text" id="wWaist" inputmode="decimal" placeholder="taille cm"></div>
      <p class="tiny muted">Billen: meetlint over het breedste punt, voeten tegen elkaar. Taille: smalste punt, na uitademen.</p>
      <button class="btn primary" data-a="addWeight">Bewaar meting</button></section>`;
  const kg = ws.filter((x) => x.kg);
  h += `<section class="card"><h3>Gewicht</h3>${lineChart(kg.map((x) => ({ v: x.kg })), "var(--pastel)")}</section>`;
  const hip = ws.filter((x) => x.hip);
  h += `<section class="card"><h3>Omtrek billen</h3>${lineChart(hip.map((x) => ({ v: x.hip })), "var(--accent)")}
    ${lastM?.hip && lastM?.waist ? `<p class="small muted">Laatste verhouding taille/billen: ${(lastM.waist / lastM.hip).toFixed(2).replace(".", ",")}</p>` : ""}</section>`;
  if (ws.length) h += `<section class="card"><h3>Metingen</h3>${[...ws].reverse().slice(0, 12).map((x) => `<div class="list-row"><span class="grow">${L.niceDate(x.date)}</span><span class="small">${[x.kg && L.fmt(x.kg) + " kg", x.hip && L.fmt(x.hip) + " cm billen", x.waist && L.fmt(x.waist) + " cm taille"].filter(Boolean).join(" · ")}</span><button class="link muted" data-a="delWeight" data-date="${x.date}">Wis</button></div>`).join("")}</section>`;
  return h;
}

// ---------- Coach ----------
const COACH = [
  ["Billen 2× per week", "Je bilspieren krijgen op beide beendagen directe sets (hip thrust, abductie, kickback, back extension) en meehelpende sets uit squats, lunges en RDL's. Elke spier 2× per week trainen is een goede basis [1, 2]."],
  ["Hip thrust én squat", "In een studie van 9 weken gaven hip thrust en squat vergelijkbare bilgroei; de squat gaf daarnaast meer groei van quadriceps en adductoren [25]. Diep squatten gaf meer bilgroei dan halve squats [18]. Daarom staan ze allebei in je schema."],
  ["Volume", "Meer harde sets geeft gemiddeld meer groei, met steeds minder winst per extra set [4, 5]. Je startschema geeft je billen ongeveer 20 sets per week. Voeg pas sets toe als je goed herstelt en je progressie stokt."],
  ["Volle beweging", "Pak de diepte: training op lange spierlengte geeft minstens zoveel groei als korte reps [19, 20]. Bij leg curls groeiden hamstrings meer in de zittende variant [15]."],
  ["Intensiteit", "Sets tot op 0–3 reps van falen geven vergelijkbare groei met minder vermoeidheid dan elke set tot falen [6, 7]. Zware oefeningen op 1–3 reps over, isolatie zoals abductie en kickbacks mag dichter op falen."],
  ["RIR loggen", "Tik na elke set aan hoeveel reps je nog over had (RIR). Dat schat je steeds beter naarmate je dichter bij falen traint [24]. Had je in alle sets 2 of meer reps over dan je doel, dan zet de app de volgende keer meer gewicht klaar."],
  ["Progressie", "De app werkt met dubbele progressie: haal je in alle sets de bovenkant van je repbereik, dan stelt hij het volgende gewicht voor. Eerst reps erbij, dan kilo's erbij."],
  ["Vrouwen en spiergroei", "Vrouwen bouwen bij hetzelfde programma relatief net zoveel spier op als mannen [26]. Vrouwen raken bij dezelfde relatieve belasting vaak minder snel vermoeid [27]; in de praktijk kun je daardoor bij isolatie goed uit de voeten met hogere reps (12–20) en kortere rust."],
  ["Je cyclus", "Je menstruatiecyclus hoeft je schema niet te sturen: onderzoek vindt gemiddeld geen of hooguit een heel klein effect van de cyclusfase op kracht en spiergroei [28, 29]. Voel je je een dag minder, houd dan wat meer reps over (RIR 2–3) in plaats van over te slaan."],
  ["Eten", "Eiwit helpt: rond 1,6 g per kilo lichaamsgewicht per dag haal je het meeste effect, daarboven wordt de extra winst klein [23]. Voor maximale groei helpt een klein calorieoverschot."],
  ["Rust", "Langere rust gaf meer groei bij samengestelde oefeningen; boven ~90 seconden wordt het extra effect kleiner [8, 9, 10]. Stel per oefening je eigen rust in bij Schema."],
];

function renderCoach() {
  const nudges = L.coachNudges(data);
  const four = L.hasFourthDay(data.program);
  const cw = L.consistentWeeks(data, 3);
  const ready = cw >= L.READY_WEEKS;
  let h = `<h2>Coach</h2>`;
  if (!window.matchMedia("(display-mode: standalone)").matches && !navigator.standalone)
    h += `<section class="card install"><h3>Zet Fit Woman op je beginscherm</h3><p class="small">Open deze pagina in Safari, tik op het deel-icoon (vierkant met pijl) en kies <b>Zet op beginscherm</b>. Dan opent hij als een app, zonder adresbalk, en blijven je gegevens bewaard.</p></section>`;
  h += `<section class="card hl"><span class="label accent">Jouw volgende stap</span>${nudges.length
    ? nudges.map((n) => `<div class="stack" style="gap:2px"><span class="label" style="color:var(--done)">${n.tag}</span><p>${esc(n.text)}</p></div>`).join("")
    : `<p>${data.sessions.length ? "Alles loopt volgens plan. Blijf in elke training één rep of een paar kilo winnen; ik meld me hier zodra iets stil komt te staan." : "Log je eerste trainingen. Na een paar weken zie je hier persoonlijke tips: waar je stil staat, waar je zwaarder kunt en hoe je billenvolume ervoor staat."}</p>`}</section>`;

  h += renderPlanner();
  h += `<section class="card"><h3>${four ? "Je traint 4 dagen per week" : "Uitbouwen naar 4 dagen"}</h3>`;
  if (four) h += `<p class="small">De vierde dag traint je bovenlichaam een tweede keer en je billen een derde keer, lichter en met meer reps. Wordt het te veel, dan kun je zonder schuldgevoel terug: consistent 3× is beter dan wisselend 4×.</p><button class="btn outline" data-a="toThree">Terug naar 3 dagen</button>`;
  else h += `<p class="small">Een vaste gewoonte heeft gemiddeld zo'n twee maanden nodig, met grote verschillen per persoon [30]. Daarom eerst 3 dagen vast, dan uitbreiden. Je bent er klaar voor als je ${L.READY_WEEKS} weken op rij al je 3 trainingen haalt.</p>
      <div class="dots6" aria-label="${Math.min(cw, L.READY_WEEKS)} van ${L.READY_WEEKS} weken">${Array.from({ length: L.READY_WEEKS }, (_, i) => `<i class="${i < cw ? "on" : ""}"></i>`).join("")}</div>
      <p class="small muted">${ready ? "Klaar! " : `${Math.min(cw, L.READY_WEEKS)} van ${L.READY_WEEKS} weken. `}De vierde dag is bovenlichaam + billen, zodat je billen 3× per week aan de beurt zijn.</p>
      <button class="btn ${ready ? "primary" : "outline"}" data-a="toFour">${ready ? "Voeg de 4e dag toe" : "Toch nu al toevoegen"}</button>`;
  h += `</section>`;

  h += `<section class="card" style="gap:0"><h3 style="margin-bottom:4px">Kennis van je coach</h3>${COACH.map(([t, x], i) => `<div class="topic"><button data-a="topic" data-i="${i}" aria-expanded="${ui.topic === i}"><span class="grow">${t}</span>${svg(ui.topic === i ? "up" : "down")}</button>${ui.topic === i ? `<p class="small">${x}</p>` : ""}</div>`).join("")}</section>`;

  const unsent = data.feedback.filter((f) => !f.sent).length;
  h += `<section class="card"><h3>Feedback voor Vai</h3><p class="small muted">Iets dat schuurt of ontbreekt? Noteer het meteen. Bij versturen gaan je schema en het aantal trainingen mee, je gewichten niet.</p>
    <div class="row"><button class="btn outline grow" data-a="feedback">Nieuwe feedback</button><button class="btn primary grow" data-a="sendFeedback" ${data.feedback.length ? "" : "disabled"}>${unsent ? `Verstuur (${unsent})` : "Verstuur alles"}</button></div>
    ${[...data.feedback].reverse().slice(0, 6).map((f) => `<div class="list-row"><div class="grow"><div class="label ${f.sent ? "muted" : "accent"}">${[f.date, f.kind, f.context, f.rating && f.rating + "/5", f.sent && "verstuurd"].filter(Boolean).map(esc).join(" · ")}</div>${f.text ? `<p class="small">${esc(f.text)}</p>` : ""}</div><button class="link muted" data-a="delFeedback" data-id="${f.id}">Wis</button></div>`).join("")}</section>`;

  h += `<section class="card"><h3>Instellingen</h3>
    <div class="field"><span>Start cyclus</span><button data-a="startDate" data-by="-7" aria-label="Week eerder">−</button><b>${L.niceDate(data.program.startDate)}</b><button data-a="startDate" data-by="7" aria-label="Week later">+</button></div>
    <button class="link" data-a="newCycle" style="align-self:flex-start">Nieuwe cyclus starten vanaf deze week</button>
    ${toggle("Rusttimer na elke set (telt rustig op, zonder geluid)", !!data.settings.restTimer, "restTimer")}
    <div class="row"><button class="btn outline grow" data-a="export">Back-up maken</button><button class="btn outline grow" data-a="import">Terugzetten</button></div>
    <p class="small muted">Je gegevens staan alleen op deze telefoon, in de app-opslag van Safari. Maak af en toe een back-up naar iCloud Drive of WhatsApp. Versie ${VERSION}.</p></section>
    <section class="card"><button class="row" data-a="toggleSrc" style="width:100%"><h3 class="grow" style="text-align:left">Bronnen (${SOURCES.length})</h3>${svg(ui.srcOpen ? "up" : "down").replace("<svg", '<svg width="22" height="22"')}</button>
    ${ui.srcOpen ? SOURCES.map((s, i) => `<div class="src"><b>[${i + 1}]</b><span>${esc(s)}</span></div>`).join("") : ""}</section>`;
  return h;
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
  openSheet(() => `<h2>Feedback voor Vai</h2>
    <div class="chips">${["Idee", "Probleem", "Schema", "Training", "Overig"].map((k) => `<button class="chip ${ui.fbKind === k ? "on" : ""}" data-a="fbKind" data-k="${k}">${k}</button>`).join("")}</div>
    <textarea class="text" id="fbText" placeholder="Wat viel je op?"></textarea>
    <div class="actions"><button class="link muted" data-a="close">Annuleren</button><button class="btn primary" data-a="saveFeedback" data-ctx="${esc(context)}">Bewaar</button></div>`);
}

function feedbackReport() {
  const items = data.feedback.filter((f) => !f.sent);
  const list = items.length ? items : data.feedback;
  const lines = [`Fit Woman feedback · versie ${VERSION} · ${navigator.userAgent.match(/iPhone OS [\d_]+/)?.[0]?.replace(/_/g, ".") || "browser"}`,
    `${data.sessions.length} trainingen gelogd sinds ${data.program.startDate}`, ""];
  for (const f of list) lines.push(`• [${[f.date, f.kind, f.context, f.rating && f.rating + "/5"].filter(Boolean).join(" · ")}] ${f.text}`.trim());
  lines.push("", `Schema (${L.weeklyTarget(data)}× per week):`);
  for (const d of data.program.days) lines.push(`${d.name}: ` + d.exercises.map((e) => `${e.name} ${e.sets}×${e.bodyweight ? "AMRAP" : `${e.repMin}-${e.repMax}`}${e.rir != null ? ` @${e.rir} RIR` : ""}${e.dropSets ? ` +${e.dropSets} drop` : ""}${e.supersetWithNext ? " [superset]" : ""}`).join(", "));
  return lines.join("\n");
}

async function shareText(title, text) {
  try {
    if (navigator.share) { await navigator.share({ title, text }); return true; }
    await navigator.clipboard.writeText(text);
    toast("Gekopieerd: plak het in WhatsApp");
    return true;
  } catch (e) { return false; }
}

// ---------- backup ----------
async function exportBackup() {
  const json = JSON.stringify({ ...data, draft: null });
  const name = `fit-woman-backup-${L.today()}.json`;
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
      const d = JSON.parse(await inp.files[0].text());
      if (!d.program?.days?.length) throw new Error("geen Fit Woman-back-up");
      update(() => ({ ...L.emptyData(), ...d, draft: null }));
      toast("Back-up teruggezet");
    } catch (e) { toast("Dit bestand kon niet worden gelezen: " + e.message); }
  };
  inp.click();
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
function render() {
  const main = $("main");
  const y = window.scrollY;
  const tabChanged = main.dataset.tab !== ui.tab;
  main.dataset.tab = ui.tab;
  main.innerHTML = { training: renderTraining, schema: renderSchema, progress: renderProgress, body: renderBody, coach: renderCoach }[ui.tab]();
  $("nav.tabs").innerHTML = TABS.map(([id, label, icon]) => `<button class="${ui.tab === id ? "on" : ""}" data-a="tab" data-id="${id}" aria-current="${ui.tab === id ? "page" : "false"}">${svg(icon)}${label}</button>`).join("");
  if (!tabChanged) window.scrollTo(0, y); else window.scrollTo(0, 0);
  renderTimer();
  if (ui.sheet) renderSheet();
}

// ---------- events ----------
const actions = {
  tab: (t) => { ui.tab = t.dataset.id; render(); },
  day: (t) => {
    const dr = currentDraft();
    const id = t.dataset.id;
    if (id === dr.dayId) return;
    const go = () => { ui.openEx = null; update((d) => ({ ...d, draft: L.freshDraft(d, id) })); };
    if (Object.values(dr.items).flat().some((s) => s.done)) confirmSheet("Van dag wisselen?", "Je hebt vandaag al sets afgevinkt. Als je wisselt, worden die niet bewaard.", "Wissel en wis sets", go);
    else go();
  },
  openEx: (t) => { const dr = currentDraft(); const day = L.findDay(data, dr.dayId); const cur = ui.openEx ?? day.exercises.find((e) => dr.items[e.id]?.some((s) => !s.done))?.id; ui.openEx = cur === t.dataset.id ? "" : t.dataset.id; render(); },
  shuffle: (t) => {
    const dr = currentDraft();
    const day = L.findDay(data, dr.dayId);
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
    const dr = currentDraft(); const day = L.findDay(data, dr.dayId);
    const slot = day.exercises.find((e) => e.id === t.dataset.id);
    const e = (dr.swaps[slot.id] && L.exercise(data, dr.swaps[slot.id])) || slot;
    editSet(slot.id, +t.dataset.i, (s) => ({ ...s, kg: L.fmt(Math.max(0, L.round1(L.toKg(s.kg) + +t.dataset.by * e.inc))) })); render();
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
  reset: () => confirmSheet("Terug naar het startschema?", "Je eigen schema wordt vervangen door het 3-dagen startschema. Gelogde trainingen en je startdatum blijven bewaard.", "Vervangen",
    () => { update((d) => ({ ...d, program: { ...L.starterProgram(), startDate: d.program.startDate }, draft: null })); ui.schemaDay = null; render(); }),

  addWeight: () => {
    const date = $("#wDate").value || L.today();
    const kg = L.toKg($("#wKg").value), hip = L.toKg($("#wHip").value), waist = L.toKg($("#wWaist").value);
    if (!kg && !hip && !waist) return toast("Vul minstens één waarde in");
    update((d) => {
      const old = d.weights.find((x) => x.date === date) || {};
      const entry = { ...old, date, ...(kg && { kg }), ...(hip && { hip }), ...(waist && { waist }) };
      return { ...d, weights: [...d.weights.filter((x) => x.date !== date), entry] };
    });
    toast("Meting bewaard");
  },
  delWeight: (t) => update((d) => ({ ...d, weights: d.weights.filter((x) => x.date !== t.dataset.date) })),

  toFour: () => confirmSheet("Naar 4 dagen per week?", "Ik voeg de dag 'Bovenlichaam + billen' toe en zet je weekdoel op 4. Je kunt hem daarna in Schema aanpassen of hier weer weghalen.", "Voeg toe",
    () => { update((d) => ({ ...d, program: L.expandToFour(d.program), draft: null })); toast("Vierde dag toegevoegd"); }),
  toThree: () => confirmSheet("Terug naar 3 dagen?", "De vierde dag gaat uit je schema en je weekdoel wordt 3. Gelogde trainingen blijven bewaard.", "Terug naar 3",
    () => update((d) => ({ ...d, program: L.backToThree(d.program), draft: null }))),
  feedback: () => feedbackSheet(ui.tab === "training" ? L.findDay(data, currentDraft().dayId)?.name : ""),
  fbKind: (t) => { const txt = $("#fbText")?.value; ui.fbKind = t.dataset.k; renderSheet(); if (txt) $("#fbText").value = txt; },
  saveFeedback: (t) => {
    const text = $("#fbText").value.trim();
    if (!text) return toast("Schrijf eerst iets op");
    update((d) => ({ ...d, feedback: [...d.feedback, { id: "f" + Date.now(), date: L.today(), kind: ui.fbKind, text, rating: null, context: t.dataset.ctx || "", sent: false }] }));
    closeSheet(); toast("Bewaard voor Vai");
  },
  sendFeedback: async () => { if (await shareText("Fit Woman feedback", feedbackReport())) update((d) => ({ ...d, feedback: d.feedback.map((f) => ({ ...f, sent: true })) })); },
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
  restTimer: () => { ui.restStart = 0; update((d) => ({ ...d, settings: { ...d.settings, restTimer: !d.settings.restTimer } })); },
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

// Schema stepper buttons share one handler per field.
for (const k of Object.keys(clampEx)) actions[k] = (t) => editProgram((p) => L.updateExercise(p, ui.schemaDay, t.dataset.id, (e) => clampEx[k](e, +t.dataset.by)));

// A new day: today's draft may be stale.
document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
render();
