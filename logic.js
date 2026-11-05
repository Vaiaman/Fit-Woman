// Training logic for Fit Woman: a port of the Fitman Max Kotlin code (Training.kt, Schema.kt),
// kept free of DOM code so it can be tested with plain Node.
import { LIBRARY } from "./library.js";

export const CYCLE_WEEKS = 12;
export const FOURTH_DAY_ID = "w4";
/** Weeks in a row with all planned trainings before the coach calls her ready for day 4. */
export const READY_WEEKS = 6;

export const MUSCLES = {
  bilspieren: "Bilspieren",
  hamstrings: "Hamstrings",
  quadriceps: "Quadriceps",
  kuiten: "Kuiten",
  rug: "Rug",
  borst: "Borst",
  "schouders-voor": "Schouder voor",
  "schouders-zij": "Schouder zij",
  "schouders-achter": "Schouder achter",
  biceps: "Biceps",
  triceps: "Triceps",
  buikspieren: "Buikspieren",
};

const LIB = Object.fromEntries(LIBRARY.map((e) => [e.id, e]));
export const libGet = (id) => LIB[id];

// ---------- dates (local time, so a training at 23:30 still counts for today) ----------
export const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const today = () => iso(new Date());
export const parseDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return iso(d); };
export const mondayOf = (s) => { const d = parseDate(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return iso(d); };
const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
export const niceDate = (s) => parseDate(s).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });

// ---------- numbers ----------
export const fmt = (n) => (n % 1 === 0 ? String(n) : n.toFixed(1).replace(".", ","));
export const toKg = (s) => { const n = parseFloat(String(s ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
export const round1 = (n) => Math.round(n * 10) / 10;

// ---------- starting plan ----------
/** Target RIR: 2 on compound lifts, 1 on isolation work, within the 0–3 range of sources [6, 7]. */
function ex(id, sets, repMin, repMax, opts = {}) {
  const base = LIB[id];
  if (!base) throw new Error("Unknown exercise " + id);
  return {
    ...base, sets, repMin: repMin ?? base.repMin, repMax: repMax ?? base.repMax,
    rir: base.rest >= 120 ? 2 : 1, dropSets: opts.drops ?? 0, supersetWithNext: !!opts.superset, cue: "",
  };
}

/**
 * Glutes and legs twice a week, upper body once [1, 2]. Glutes get direct work on both lower days
 * (hip thrust, abduction, kickback, back extension) plus assisting sets from deep squats,
 * split squats and hinges [18, 25].
 */
export function starterProgram() {
  return {
    name: "Billen & benen · 3 dagen",
    startDate: firstMonday(),
    weeklyTarget: 3,
    days: [
      { id: "w1", name: "Billen & benen A", exercises: [
        ex("hip-thrust", 4, 8, 12),
        ex("barbell-squat", 3, 6, 10),
        ex("seated-leg-curl", 3, 10, 12),
        ex("hip-abduction", 3, 12, 20, { drops: 1 }),
        ex("standing-calf-raise", 3, 10, 15),
      ] },
      { id: "w2", name: "Bovenlichaam", exercises: [
        ex("lat-pulldown", 3, 8, 12),
        ex("incline-db-press", 3, 8, 12),
        ex("seated-cable-row", 3, 10, 12),
        ex("db-lateral-raise", 3, 12, 15),
        ex("incline-db-curl", 3, 10, 12, { superset: true }),
        ex("overhead-triceps-extension", 3, 10, 12),
      ] },
      { id: "w3", name: "Billen & benen B", exercises: [
        ex("romanian-deadlift", 4, 8, 10),
        ex("bulgarian-split-squat", 3, 8, 12),
        ex("leg-press", 3, 10, 15),
        ex("back-extension-45", 3, 12, 15),
        ex("cable-kickback", 3, 12, 15),
      ] },
    ],
  };
}

/** The cycle starts this Monday, or next Monday when the app is first opened at the weekend. */
export function firstMonday() {
  const t = today();
  const wd = (parseDate(t).getDay() + 6) % 7;
  return wd >= 5 ? addDays(mondayOf(t), 7) : mondayOf(t);
}

/** Upper body a second time and glutes a third time, with lighter, higher-rep work. */
export function fourthDay() {
  return { id: FOURTH_DAY_ID, name: "Bovenlichaam + billen", exercises: [
    ex("single-arm-cable-row", 3, 10, 12),
    ex("machine-shoulder-press", 3, 8, 12),
    ex("pec-deck", 3, 12, 15),
    ex("hip-thrust", 3, 12, 15),
    ex("hip-abduction", 3, 15, 20),
  ] };
}

export function emptyData() {
  return { version: 1, program: starterProgram(), sessions: [], weights: [], draft: null, customExercises: [], feedback: [], weekPlans: [], settings: { restTimer: false } };
}

// ---------- lookups ----------
export const allExercises = (d) => d.program.days.flatMap((day) => day.exercises);
export const exercise = (d, id) => allExercises(d).find((e) => e.id === id) || d.customExercises.find((e) => e.id === id) || LIB[id];
export const primaryMuscle = (e) => Object.entries(e.muscles || {}).sort((a, b) => b[1] - a[1])[0]?.[0];
export const isGlute = (e) => primaryMuscle(e) === "bilspieren";

/** Other exercises for the same main muscle, for when a machine is taken. */
export function alternatives(d, e, exclude) {
  const m = primaryMuscle(e);
  if (!m) return [];
  return [...LIBRARY, ...d.customExercises].filter((x) => x.id !== e.id && !exclude.has(x.id) && primaryMuscle(x) === m);
}

// ---------- cycle and weeks ----------
export const weekOf = (d, date) => Math.max(1, Math.floor(daysBetween(d.program.startDate, date) / 7) + 1);
export const currentWeek = (d) => weekOf(d, today());
export const inCycle = (d) => d.sessions.filter((s) => s.date >= d.program.startDate).sort((a, b) => a.date.localeCompare(b.date));
export const weeklyTarget = (d) => Math.max(1, d.program.weeklyTarget ?? d.program.days.length);

/** The adjusted plan for the week that starts on `monday`, if she made one with the week planner. */
export const planFor = (d, monday) => (d.weekPlans || []).find((p) => p.monday === monday) || null;
export const currentPlan = (d) => planFor(d, mondayOf(today()));
/** Trainings that count as "on schedule" in a calendar week: the planned number when she adjusted that week. */
export const targetForWeek = (d, monday) => planFor(d, monday)?.slots.length ?? weeklyTarget(d);
/** Program days plus this week's combined workouts from the planner, so the Training tab can log them. */
export const trainingDays = (d) => [...d.program.days, ...(currentPlan(d)?.extraDays || [])];
export const findDay = (d, id) => trainingDays(d).find((x) => x.id === id) || (d.weekPlans || []).flatMap((p) => p.extraDays || []).find((x) => x.id === id);
export const cycleSessions = (d) => weeklyTarget(d) * CYCLE_WEEKS;

export function weekStats(d) {
  const ss = inCycle(d);
  return Array.from({ length: CYCLE_WEEKS }, (_, i) => {
    const w = i + 1;
    const list = ss.filter((s) => weekOf(d, s.date) === w);
    return { week: w, sessions: list.length, volume: list.reduce((a, s) => a + volume(s), 0), target: targetForWeek(d, addDays(d.program.startDate, (w - 1) * 7)) };
  });
}

/** Weeks with all planned trainings, counted back from the last full week. One missed week per cycle is forgiven. */
export function streak(d) {
  const stats = weekStats(d);
  const cur = Math.min(currentWeek(d), CYCLE_WEEKS);
  let w = stats[cur - 1].sessions >= stats[cur - 1].target ? cur : cur - 1;
  let n = 0, joker = true;
  while (w >= 1) {
    if (stats[w - 1].sessions >= stats[w - 1].target) n++;
    else if (joker && n > 0) joker = false;
    else break;
    w--;
  }
  return { weeks: n, jokerUsed: !joker };
}

/**
 * Weeks in a row (no joker) with at least 3 trainings, counted back over calendar weeks from
 * Monday, independent of the cycle. Used to judge readiness for a fourth day.
 */
export function consistentWeeks(d, perWeek = 3) {
  const thisMonday = mondayOf(today());
  const count = (mon) => d.sessions.filter((s) => s.date >= mon && s.date < addDays(mon, 7)).length;
  let mon = count(thisMonday) >= perWeek ? thisMonday : addDays(thisMonday, -7);
  let n = 0;
  while (count(mon) >= perWeek && n < 52) { n++; mon = addDays(mon, -7); }
  return n;
}

// ---------- progression ----------
/** Epley estimate of a one-rep max, capped at 12 reps where the formula stops being useful. */
export const e1rm = (kg, reps) => (kg > 0 ? kg * (1 + Math.min(reps, 12) / 30) : 0);
export const setScore = (e, s) => (e.bodyweight ? s.kg * 100 + s.reps : e1rm(s.kg, s.reps));
export const volume = (s) => s.items.reduce((a, i) => a + i.sets.reduce((b, st) => b + st.kg * st.reps, 0), 0);

export function lastFor(d, exId, before) {
  const s = d.sessions
    .filter((x) => (!before || x.date < before) && x.items.some((i) => i.exId === exId && i.sets.length))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!s) return null;
  const sets = s.items.find((i) => i.exId === exId).sets.filter((x) => !x.drop);
  return sets.length ? { date: s.date, sets } : null;
}

export function bestScore(d, e, before) {
  let best = 0;
  for (const s of d.sessions) {
    if (before && s.date >= before) continue;
    for (const i of s.items) if (i.exId === e.id) for (const st of i.sets) best = Math.max(best, setScore(e, st));
  }
  return best;
}

/**
 * Double progression: when every working set reached the top of the rep range, add weight;
 * otherwise keep the weight and add one rep to the weakest set. With a RIR target, sets that
 * felt 2+ reps easier than planned also earn more weight (RIR autoregulation, source [24]).
 */
export function suggestion(d, e) {
  const last = lastFor(d, e.id, today());
  if (!last) return {
    kg: null, reps: [],
    text: e.bodyweight ? "Eerste keer: noteer hoeveel reps je per set haalt."
      : `Eerste keer: kies een gewicht waarmee je ${e.repMin}–${e.repMax} reps haalt met 2–3 reps over.`,
  };
  const top = Math.max(...last.sets.map((s) => s.kg));
  const work = last.sets.filter((s) => s.kg === top);
  if (e.bodyweight) {
    const total = last.sets.reduce((a, s) => a + s.reps, 0);
    return { kg: top, reps: last.sets.map((s) => s.reps + 1), text: `Vorige keer ${total} reps totaal. Doel: ${total + 1} of meer.` };
  }
  if (work.every((s) => s.reps >= e.repMax)) {
    const kg = round1(top + e.inc);
    return { kg, reps: last.sets.map(() => e.repMin), text: `Alle sets op ${e.repMax} reps. Tijd voor ${fmt(kg)} kg × ${e.repMin}+.` };
  }
  const t = e.rir;
  if (t != null && work.every((s) => s.rir != null && s.rir >= t + 2 && s.reps >= e.repMin)) {
    const kg = round1(top + e.inc);
    return { kg, reps: last.sets.map(() => e.repMin), text: `Vorige keer had je nog ${Math.min(...work.map((s) => s.rir))}+ reps over bij een doel van ${t} RIR. Probeer ${fmt(kg)} kg.` };
  }
  let weakest = 0;
  work.forEach((s, i) => { if (s.reps < work[weakest].reps) weakest = i; });
  const reps = last.sets.map((s, i) => (i === weakest ? s.reps + 1 : s.reps));
  return { kg: top, reps, text: `Blijf op ${fmt(top)} kg en pak in set ${weakest + 1} één rep meer (${work[weakest].reps} → ${work[weakest].reps + 1}).` };
}

/** Working sets prefilled from the suggestion, then drop sets about 20% lighter each, rounded to the weight step. */
export function draftSets(d, e, count, drops = 0) {
  const s = suggestion(d, e);
  const out = Array.from({ length: count }, (_, i) => ({ kg: s.kg != null ? fmt(s.kg) : "", reps: "", goal: s.reps[i] ?? null, done: false, pr: false, rir: null, drop: false }));
  let kg = s.kg ?? 0;
  for (let i = 0; i < drops; i++) {
    kg = kg > 0 ? Math.round((kg * 0.8) / e.inc) * e.inc : 0;
    out.push({ kg: kg > 0 ? fmt(round1(kg)) : "", reps: "", goal: null, done: false, pr: false, rir: null, drop: true });
  }
  return out;
}

export function freshDraft(d, dayId) {
  const day = findDay(d, dayId) || d.program.days[0];
  const items = {};
  for (const e of day.exercises) items[e.id] = draftSets(d, e, e.sets, e.dropSets);
  return { date: today(), dayId: day.id, items, swaps: {} };
}

/** Keeps today's draft in step with a schema edited in the meantime; finished sets are never thrown away. */
export function reconcile(d, draft) {
  const day = findDay(d, draft.dayId);
  if (!day) return freshDraft(d, nextDayId(d));
  let changed = false;
  const items = { ...draft.items };
  for (const slot of day.exercises) {
    const cur = items[slot.id];
    if (!cur || (!cur.some((s) => s.done) && (cur.filter((s) => !s.drop).length !== slot.sets || cur.filter((s) => s.drop).length !== slot.dropSets))) {
      const e = (draft.swaps[slot.id] && exercise(d, draft.swaps[slot.id])) || slot;
      items[slot.id] = draftSets(d, e, slot.sets, slot.dropSets);
      changed = true;
    }
  }
  return changed ? { ...draft, items } : draft;
}

/**
 * The day to train next. With a week plan: today's planned workout, else the first planned one
 * not yet done. Without: the one after the day trained last.
 */
export function nextDayId(d) {
  const plan = currentPlan(d);
  if (plan) {
    const done = new Set(d.sessions.filter((s) => s.date >= plan.monday).map((s) => s.dayId));
    const open = plan.slots.filter((x) => !done.has(x.dayId));
    const pick = open.find((x) => x.date === today()) || open.find((x) => x.date > today()) || open[0];
    if (pick && findDay(d, pick.dayId)) return pick.dayId;
  }
  return nextProgramDay(d);
}

function nextProgramDay(d) {
  const ids = new Set(d.program.days.map((x) => x.id));
  const last = d.sessions.filter((s) => ids.has(s.dayId)).sort((a, b) => (a.date + a.id).localeCompare(b.date + b.id)).pop();
  if (!last) return d.program.days[0].id;
  const i = d.program.days.findIndex((x) => x.id === last.dayId);
  return d.program.days[(i + 1) % d.program.days.length].id;
}

export function estimatedMinutes(day) {
  const secs = day.exercises.reduce((a, e) => a + (e.sets + e.dropSets) * 40 + e.sets * (e.supersetWithNext ? 0 : e.rest), 0);
  return 10 + Math.round(secs / 60);
}

/** Direct sets count 1, assisting sets 0.5, summed over the week. */
export function muscleSets(program) {
  const out = {};
  for (const day of program.days) for (const e of day.exercises) for (const [m, f] of Object.entries(e.muscles || {})) out[m] = (out[m] || 0) + f * e.sets;
  return out;
}

/** Superset letters for a day: consecutive linked exercises share a letter (A1, A2, B1 …). */
export function supersetLabels(list) {
  const out = list.map(() => null);
  let letter = 65, i = 0;
  while (i < list.length) {
    let j = i;
    while (j < list.length - 1 && list[j].supersetWithNext) j++;
    if (j > i) { for (let k = i; k <= j; k++) out[k] = String.fromCharCode(letter) + (k - i + 1); letter++; }
    i = j + 1;
  }
  return out;
}

export function exerciseSeries(d, e) {
  let best = 0;
  return inCycle(d).flatMap((s) => {
    const sets = s.items.find((i) => i.exId === e.id)?.sets;
    if (!sets?.length) return [];
    const top = sets.reduce((a, b) => (setScore(e, b) > setScore(e, a) ? b : a));
    const v = e.bodyweight ? sets.reduce((a, b) => a + b.reps, 0) : e1rm(top.kg, top.reps);
    const rec = best > 0 && v > best;
    best = Math.max(best, v);
    return [{ date: s.date, value: v, top, record: rec }];
  });
}

export function trackedExercises(d) {
  const logged = new Set(d.sessions.flatMap((s) => s.items.map((i) => i.exId)));
  const prog = allExercises(d);
  const seen = new Set();
  const out = [];
  for (const e of [...prog, ...[...logged].map((id) => exercise(d, id)).filter(Boolean)]) if (!seen.has(e.id)) { seen.add(e.id); out.push(e); }
  return out;
}

export function recordCount(d) {
  let n = 0;
  for (const e of trackedExercises(d)) n += exerciseSeries(d, e).filter((p) => p.record).length;
  return n;
}

// ---------- schema edits (pure) ----------
export const updateDay = (p, dayId, f) => ({ ...p, days: p.days.map((x) => (x.id === dayId ? f(x) : x)) });
export const updateExercise = (p, dayId, exId, f) => updateDay(p, dayId, (x) => ({ ...x, exercises: x.exercises.map((e) => (e.id === exId ? f(e) : e)) }));
const move = (list, i, by) => { const j = i + by; if (i < 0 || j < 0 || j >= list.length) return list; const c = [...list]; c.splice(j, 0, c.splice(i, 1)[0]); return c; };
export const moveExercise = (p, dayId, exId, by) => updateDay(p, dayId, (x) => ({ ...x, exercises: move(x.exercises, x.exercises.findIndex((e) => e.id === exId), by) }));
export const removeExercise = (p, dayId, exId) => updateDay(p, dayId, (x) => ({ ...x, exercises: x.exercises.filter((e) => e.id !== exId) }));
export const addExercise = (p, dayId, e) => updateDay(p, dayId, (x) => (x.exercises.some((y) => y.id === e.id) ? x : { ...x, exercises: [...x.exercises, e] }));
export const replaceExercise = (p, dayId, exId, other) => updateDay(p, dayId, (x) =>
  x.exercises.some((y) => y.id === other.id) ? x : { ...x, exercises: x.exercises.map((e) => (e.id === exId ? { ...other, sets: e.sets, rir: e.rir, dropSets: e.dropSets, supersetWithNext: e.supersetWithNext } : e)) });
export const addDay = (p, id) => ({ ...p, days: [...p.days, { id, name: `Dag ${p.days.length + 1}`, exercises: [] }] });
export function duplicateDay(p, dayId, newId) {
  const i = p.days.findIndex((x) => x.id === dayId);
  if (i < 0) return p;
  const days = [...p.days];
  days.splice(i + 1, 0, { ...p.days[i], id: newId, name: p.days[i].name + " (kopie)" });
  return { ...p, days };
}
export const removeDay = (p, dayId) => (p.days.length <= 1 ? p : { ...p, days: p.days.filter((x) => x.id !== dayId) });
export const moveDay = (p, dayId, by) => ({ ...p, days: move(p.days, p.days.findIndex((x) => x.id === dayId), by) });

/** From 3 to 4 days: the extra day goes last, so the week alternates lower, upper, lower, upper. */
export function expandToFour(p) {
  if (p.days.some((x) => x.id === FOURTH_DAY_ID)) return p;
  return { ...p, days: [...p.days, fourthDay()], weeklyTarget: Math.max(4, p.weeklyTarget ?? 0) };
}
export function backToThree(p) {
  return { ...p, days: p.days.filter((x) => x.id !== FOURTH_DAY_ID), weeklyTarget: 3 };
}
export const hasFourthDay = (p) => p.days.some((x) => x.id === FOURTH_DAY_ID);

// ---------- personal coach notes from her own data ----------
/**
 * Up to a few concrete next steps, most useful first: a stalled lift, sets that are too easy,
 * too little or too much glute volume, readiness for a fourth day.
 */
export function coachNudges(d) {
  const out = [];
  const glute = muscleSets(d.program).bilspieren || 0;

  for (const e of allExercises(d)) {
    const series = d.sessions
      .filter((s) => s.items.some((i) => i.exId === e.id && i.sets.some((x) => !x.drop)))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => Math.max(...s.items.find((i) => i.exId === e.id).sets.filter((x) => !x.drop).map((x) => setScore(e, x))));
    if (series.length >= 4) {
      const last3 = series.slice(-3);
      const before = Math.max(...series.slice(0, -3));
      if (Math.max(...last3) <= before) out.push({
        tag: "Stilstand", ex: e.id,
        text: `${e.name} is al 3 trainingen niet vooruitgegaan. Check eerst slaap en eten. Houd je per set nog 2+ reps over, train dan 1 rep dichter op falen [6, 7]. Helpt dat na 2 weken niet, wissel dan naar een variant voor dezelfde spier (shuffle-knop of Schema).`,
      });
    }
    const last = lastFor(d, e.id);
    if (last && e.rir != null && last.sets.length >= 2 && last.sets.every((x) => x.rir != null && x.rir >= e.rir + 2) && !out.some((o) => o.ex === e.id)) out.push({
      tag: "Te makkelijk", ex: e.id,
      text: `Bij ${e.name} had je vorige keer in elke set ${e.rir + 2}+ reps over, terwijl je doel ${e.rir} is. Pak de volgende keer zwaarder: de app zet het nieuwe gewicht al klaar.`,
    });
  }

  if (glute < 10) out.push({ tag: "Billen", text: `Je schema geeft je bilspieren nu ${fmt(glute)} sets per week. Voor jouw doel is 12–20 een goede werkrange [4, 5]: voeg een hip thrust, abductie of kickback toe in Schema.` });
  else if (glute > 26) out.push({ tag: "Billen", text: `Je bilspieren krijgen ${fmt(glute)} sets per week. Dat kan werken, maar de meeropbrengst per extra set wordt kleiner [4, 5]. Herstel je niet goed of stokt je progressie, haal er dan eerst sets af.` });

  const cw = consistentWeeks(d, 3);
  if (!hasFourthDay(d.program) && cw >= READY_WEEKS) out.push({ tag: "Klaar voor meer", text: `Je haalt al ${cw} weken op rij al je trainingen. Je bent klaar om naar 4 dagen te gaan: zie hieronder.` });
  return out.slice(0, 4);
}

// ---------- week planner ----------
const DAY_NAMES = ["ma", "di", "wo", "do", "vr", "za", "zo"];
export const dayShort = (date) => DAY_NAMES[(parseDate(date).getDay() + 6) % 7];

/** A day counts as a glute/leg day when it holds at least 6 weekly sets for glutes, quads or hamstrings. */
export function isLowerDay(day) {
  const m = muscleSets({ days: [day] });
  return (m.bilspieren || 0) + (m.quadriceps || 0) + (m.hamstrings || 0) >= 6;
}

/**
 * Puts the workouts on the dates she has. Glute and leg days get at least 48 hours between
 * them where the dates allow it; two trainings on consecutive days cost a little; spreading
 * the week evenly wins ties. Brute force: at most 7 dates and 4 workouts.
 */
function bestSchedule(dates, days, lastLowerDate) {
  let best = null;
  const choose = (start, k, acc, out) => { if (acc.length === k) { out.push([...acc]); return; } for (let i = start; i < dates.length; i++) { acc.push(dates[i]); choose(i + 1, k, acc, out); acc.pop(); } };
  const perms = (arr) => (arr.length <= 1 ? [arr] : arr.flatMap((x, i) => perms([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p])));
  const subsets = [];
  choose(0, days.length, [], subsets);
  // Keep the program order (A, upper, B …) unless a different order clearly recovers better.
  const orders = perms(days.map((_, i) => i));
  for (const ds of subsets) for (const order of orders) {
    let score = 0;
    const seq = order.map((i, j) => ({ date: ds[j], day: days[i], lower: isLowerDay(days[i]) }));
    const lowers = seq.filter((x) => x.lower).map((x) => x.date);
    if (lastLowerDate && lowers.length) lowers.unshift(lastLowerDate);
    for (let i = 1; i < lowers.length; i++) { const gap = daysBetween(lowers[i - 1], lowers[i]); if (gap < 2) score -= 10 * (2 - gap); }
    for (let i = 1; i < seq.length; i++) {
      const gap = daysBetween(seq[i - 1].date, seq[i].date);
      if (gap === 1) score -= 1;
      score += Math.min(gap, 3) * 0.1;
    }
    order.forEach((i, j) => { if (i !== j) score -= 0.05; });
    if (!best || score > best.score) best = { score, slots: seq.map((x) => ({ date: x.date, dayId: x.day.id })) };
  }
  return best?.slots || [];
}

/**
 * Fewer dates than workouts: merge workouts into full-body sessions. Leg days are spread over the
 * sessions first, the upper body is added to the session with the least work. From each merged
 * day the first exercises are kept, which are the heavy main lifts.
 */
function mergeDays(days, n, monday) {
  const buckets = Array.from({ length: n }, () => []);
  const lower = days.filter(isLowerDay), upper = days.filter((x) => !isLowerDay(x));
  lower.forEach((x, i) => buckets[i % n].push(x));
  for (const x of upper) buckets.sort((a, b) => a.length - b.length)[0].push(x);
  return buckets.filter((b) => b.length).map((b, i) => {
    if (b.length === 1) return b[0];
    const per = b.length === 2 ? 3 : 2;
    const exercises = [];
    for (const day of b) {
      const take = day.exercises.slice(0, per);
      take.forEach((e, j) => exercises.push({ ...e, supersetWithNext: e.supersetWithNext && j < take.length - 1 }));
    }
    const seen = new Set();
    return {
      id: `wp${monday.replace(/-/g, "")}${i + 1}`,
      name: "Combi: " + b.map((x) => x.name.replace("Billen & benen", "Billen")).join(" + "),
      exercises: exercises.filter((e) => !seen.has(e.id) && seen.add(e.id)),
      combined: b.map((x) => x.id),
    };
  });
}

/**
 * The week planner behind "Plan je week" in Coach. `dates` are the days she can train.
 * Returns a plan to show first and save only when she confirms.
 */
export function planWeek(d, monday, dates) {
  const sorted = [...new Set(dates)].sort();
  const doneThisWeek = d.sessions.filter((s) => s.date >= monday && s.date < addDays(monday, 7));
  // A combined workout covers the program days it was made from.
  const doneIds = new Set(doneThisWeek.flatMap((s) => findDay(d, s.dayId)?.combined || [s.dayId]));
  // The rest of the rotation, starting with the workout that is due.
  const order = [];
  const startId = nextProgramDay({ ...d, sessions: d.sessions.filter((s) => s.date < monday) });
  const i0 = Math.max(0, d.program.days.findIndex((x) => x.id === startId));
  for (let k = 0; k < d.program.days.length; k++) order.push(d.program.days[(i0 + k) % d.program.days.length]);
  const todo = order.filter((x) => !doneIds.has(x.id) && x.exercises.length).slice(0, Math.max(0, weeklyTarget(d) - doneThisWeek.length));
  const lastLower = d.sessions.filter((s) => s.date < (sorted[0] || monday)).sort((a, b) => b.date.localeCompare(a.date))
    .find((s) => { const day = findDay(d, s.dayId); return day && isLowerDay(day); })?.date;

  if (!sorted.length || !todo.length) return { monday, slots: [], extraDays: [], notes: [todo.length ? "Kies minstens één dag." : "Je hebt je trainingen van deze week al gedaan. Lekker bezig!"] };
  const notes = [];
  let days = todo, extraDays = [];
  if (sorted.length < todo.length) {
    days = mergeDays(todo, sorted.length, monday);
    extraDays = days.filter((x) => x.combined);
    notes.push(`Je hebt ${sorted.length} ${sorted.length === 1 ? "dag" : "dagen"} voor ${todo.length} trainingen. Ik combineer ze tot ${sorted.length === 1 ? "één full-body training" : `${sorted.length} full-body trainingen`} met de zware basisoefeningen van elke dag, zodat al je spiergroepen aan bod komen.`);
    notes.push("Je doet deze week minder sets dan normaal. Dat is geen probleem: in onderzoek bleef spiermassa behouden met ongeveer een derde van het normale volume, zolang de zwaarte bleef [31]. Train deze sessies dus gewoon zwaar, met 1–2 reps over.");
  }
  const slots = bestSchedule(sorted, days, lastLower);
  const lowers = slots.filter((x) => isLowerDay(days.find((y) => y.id === x.dayId)));
  let tight = false;
  for (let i = 1; i < lowers.length; i++) if (daysBetween(lowers[i - 1].date, lowers[i].date) < 2) tight = true;
  if (lowers.length > 1 && !tight) notes.unshift("Tussen je billen- en beendagen zit minstens 48 uur, zodat je spieren kunnen herstellen. Een bovenlichaamdag mag er gerust tussen of direct naast.");
  if (tight) notes.unshift("Twee beendagen liggen dichter dan 48 uur bij elkaar; met deze dagen kan het niet anders. Houd op de tweede dag 2–3 reps over en sla zo nodig de laatste set over.");
  return { monday, slots, extraDays, notes };
}
