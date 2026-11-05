// Schema generator: builds a program from the questionnaire, with fixed rules and no network.
// The same rules live in the Android apps (logic/Generator.kt), so the same answers give the
// same schema everywhere. Numbers in [n] point into SOURCES in library.js.
import { LIBRARY } from "./library.js";
import { MUSCLES } from "./logic.js";

export const GOALS = { spier: "Spiergroei", kracht: "Kracht", beide: "Kracht + spier", onderhoud: "Fit blijven (onderhoud)" };
export const FOCUS = {
  bovenlichaam: "Bovenlichaam", onderlichaam: "Onderlichaam", borst: "Borst", rug: "Rug",
  schouders: "Schouders", armen: "Armen", billen: "Billen", benen: "Benen",
};
export const LEVELS = { nieuw: "Net begonnen (< 6 mnd)", basis: "6 mnd – 2 jaar", gevorderd: "2 – 5 jaar", ervaren: "5+ jaar", pauze: "Weer bezig na een pauze" };
export const PLACES = { gym: "Volledige sportschool", klein: "Kleine gym (dumbbells + kabels)", thuis: "Thuis met dumbbells" };
export const INJURIES = { onderrug: "Onderrug", knie: "Knie", schouder: "Schouder", elleboog: "Elleboog of pols", heup: "Heup" };
export const INTENSITY = { rustig: "Rustig (3 RIR)", stevig: "Stevig (1–2 RIR)", falen: "Tot (bijna) falen (0–1 RIR)" };
export const REPS = { mix: "Mix (aanbevolen)", zwaar: "Zwaar (5–8)", gemiddeld: "Gemiddeld (8–12)", licht: "Licht (12–20)" };
export const MINUTES = [30, 45, 60, 75, 90];

/** Source numbers that differ per app: repetition continuum, time-efficient training, advanced techniques, drop sets, maintenance. */
const S = { cont: 32, time: 33, adv: 34, drop: 35, maint: 31 };

export function defaultAnswers(app = "fitwoman") {
  return {
    goal: "spier", focus: app === "fitwoman" ? ["billen"] : [], days: 3, minutes: 60,
    level: app === "fitwoman" ? "basis" : "pauze", supersets: false, dropsets: false,
    place: "gym", injuries: [], likes: [], dislikes: [], intensity: "stevig", reps: "mix",
  };
}

// ---------- tables ----------
const FOCUS_MUSCLES = {
  bovenlichaam: ["borst", "rug", "schouders-zij", "schouders-achter", "biceps", "triceps"],
  onderlichaam: ["quadriceps", "hamstrings", "bilspieren", "kuiten"],
  borst: ["borst"], rug: ["rug"], schouders: ["schouders-zij", "schouders-achter"],
  armen: ["biceps", "triceps"], billen: ["bilspieren"], benen: ["quadriceps", "hamstrings", "kuiten"],
};
const LOWER_FOCUS = ["onderlichaam", "billen", "benen"];
const BIG = ["bilspieren", "quadriceps", "hamstrings", "rug", "borst", "schouders-zij"];
const SMALL = ["biceps", "triceps", "schouders-achter"];
const BASE_SETS = { nieuw: 8, pauze: 8, basis: 11, gevorderd: 14, ervaren: 16 };

const DAY_MUSCLES = {
  full: [...BIG, ...SMALL, "kuiten"],
  upper: ["borst", "rug", "schouders-zij", "schouders-achter", "biceps", "triceps"],
  lower: ["bilspieren", "quadriceps", "hamstrings", "kuiten"],
  push: ["borst", "schouders-zij", "triceps"],
  pull: ["rug", "schouders-achter", "biceps"],
};

/** What each exercise needs. Anything not listed needs a full gym. */
const EQUIP = {
  dumbbell: ["incline-db-press", "flat-db-press", "one-arm-db-row", "shoulder-press-db", "db-lateral-raise", "incline-db-curl", "hammer-curl",
    "bulgarian-split-squat", "walking-lunge", "romanian-deadlift", "hip-thrust", "overhead-triceps-extension", "standing-calf-raise"],
  cable: ["cable-fly", "lat-pulldown", "seated-cable-row", "single-arm-cable-row", "cable-lateral-raise", "facepulls", "rear-delt-cable-fly",
    "triceps-pushdown", "cable-kickback", "cable-crunch"],
  bar: ["pull-ups", "dips", "hanging-leg-raise"],
};
const PLACE_ALLOWS = { gym: null, klein: ["dumbbell", "cable", "bar"], thuis: ["dumbbell"] };

/** Exercises left out for a complaint; a gentler option for the same muscle is picked instead. */
const AVOID = {
  onderrug: ["barbell-squat", "deadlift", "barbell-row", "romanian-deadlift", "overhead-press", "smith-squat"],
  knie: ["barbell-squat", "hack-squat", "smith-squat", "bulgarian-split-squat", "walking-lunge", "leg-extension"],
  schouder: ["barbell-bench-press", "dips", "overhead-press", "smith-shoulder-press", "shoulder-press-db"],
  elleboog: ["skull-crusher", "barbell-curl", "preacher-curl", "dips"],
  heup: ["deadlift", "bulgarian-split-squat", "walking-lunge"],
};

/** Heavy on the whole body and slow to recover from; only first choice when strength is the goal. */
const TIRING = ["deadlift", "barbell-row"];
/** Lifts that suit heavy sets of 3–6; preferred when strength is part of the goal. */
const STRONG = ["barbell-squat", "hack-squat", "leg-press", "deadlift", "romanian-deadlift", "barbell-bench-press", "incline-db-press",
  "flat-db-press", "overhead-press", "shoulder-press-db", "barbell-row", "chest-supported-row", "pull-ups"];

const primary = (e) => Object.entries(e.muscles || {}).sort((a, b) => b[1] - a[1])[0]?.[0];
const isCompound = (e) => e.rest >= 120;
const equipOf = (id) => Object.keys(EQUIP).find((k) => EQUIP[k].includes(id)) || "gym";

/** Same formula as the Training tab: 40 s per set plus rest, 10 min warm-up and changing over. */
export function minutesOf(exs) {
  const secs = exs.reduce((a, e) => a + (e.sets + e.dropSets) * 40 + e.sets * (e.supersetWithNext ? 0 : e.rest), 0);
  return 10 + Math.round(secs / 60);
}

// ---------- the five steps ----------
/** Step 1: weekly sets per muscle, from experience and goal [4, 5]; other muscles keep a maintenance dose (S.maint). */
export function weeklyTargets(a) {
  const base = a.goal === "onderhoud" ? 6 : BASE_SETS[a.level] ?? 11;
  const focus = new Set(a.focus.flatMap((f) => FOCUS_MUSCLES[f] || []));
  const bonus = a.goal === "onderhoud" ? 3 : 5;
  const out = {};
  for (const m of [...BIG, ...SMALL, "kuiten"]) {
    if (m === "kuiten" && !focus.has(m)) continue;
    const scale = SMALL.includes(m) || m === "kuiten" ? 0.7 : 1;
    let t = focus.size && !focus.has(m) ? Math.max(5, base - 3) : base;
    if (focus.has(m)) t += bonus;
    out[m] = Math.round(t * scale);
  }
  return { targets: out, focus };
}

/** Step 2: the split, so every muscle is trained at least twice a week where the days allow [1, 2]. */
export function splitFor(a) {
  const lower = a.focus.length > 0 && a.focus.every((f) => LOWER_FOCUS.includes(f));
  const upper = a.focus.length > 0 && a.focus.every((f) => !LOWER_FOCUS.includes(f));
  switch (a.days) {
    case 1: return ["full"];
    case 2: return ["full", "full"];
    case 3: return lower ? ["lower", "upper", "lower"] : upper ? ["upper", "lower", "upper"] : ["full", "full", "full"];
    case 4: return lower ? ["lower", "upper", "lower", "full"] : upper ? ["upper", "lower", "upper", "full"] : ["upper", "lower", "upper", "lower"];
    case 5: return ["upper", "lower", "push", "pull", "lower"];
    default: return ["push", "pull", "lower", "push", "pull", "lower"];
  }
}

function dayNames(types, a) {
  const glutes = a.focus.includes("billen");
  const label = { full: "Full body", upper: "Bovenlichaam", lower: glutes ? "Billen & benen" : "Benen", push: "Push", pull: "Pull" };
  const count = {}, seen = {};
  types.forEach((t) => (count[t] = (count[t] || 0) + 1));
  return types.map((t) => {
    seen[t] = (seen[t] || 0) + 1;
    return count[t] > 1 ? `${label[t]} ${String.fromCharCode(64 + seen[t])}` : label[t];
  });
}

function pool(a) {
  const allowed = PLACE_ALLOWS[a.place];
  const avoid = new Set(a.injuries.flatMap((i) => AVOID[i] || []));
  const dislikes = new Set(a.dislikes);
  return LIBRARY.filter((e) => !dislikes.has(e.id) && !avoid.has(e.id) && (!allowed || allowed.includes(equipOf(e.id))));
}

/** Reps, rest and RIR from goal and preferences [3, 6, 7, 8]. */
function dose(e, a, firstCompound) {
  const c = isCompound(e);
  let range;
  if (a.goal === "kracht") range = c ? (firstCompound ? [3, 6] : [5, 8]) : [8, 12];
  else if (a.goal === "beide" && c && firstCompound) range = [4, 6];
  else if (a.goal === "onderhoud") range = c ? [8, 12] : [10, 15];
  else range = { zwaar: c ? [5, 8] : [8, 10], gemiddeld: c ? [8, 12] : [10, 12], licht: c ? [10, 15] : [12, 20] }[a.reps] || (c ? [Math.max(5, e.repMin), Math.max(8, e.repMax)] : [e.repMin, e.repMax]);
  let rir = { rustig: [3, 3], stevig: [2, 1], falen: [1, 0] }[a.intensity] || [2, 1];
  rir = c ? rir[0] : rir[1];
  if (c && (a.level === "nieuw" || a.level === "pauze")) rir = Math.max(rir, 2);
  if (a.goal === "onderhoud") rir = Math.min(3, rir + 1);
  const heavy = c && (a.goal === "kracht" || (a.goal === "beide" && firstCompound));
  return {
    repMin: e.bodyweight ? e.repMin : range[0], repMax: e.bodyweight ? e.repMax : range[1],
    rest: heavy ? Math.max(e.rest, 180) : e.rest, rir,
  };
}

/** Steps 3–5 for one day: fill the muscles with the most sets still open, then fit the time. */
function buildDay(type, share, ctx, a, usedElsewhere) {
  const need = {};
  for (const m of DAY_MUSCLES[type]) if (ctx.targets[m]) need[m] = ctx.targets[m] * share[m];
  const maxEx = a.minutes <= 30 ? 4 : a.minutes <= 45 ? 5 : a.minutes <= 60 ? 6 : a.minutes <= 75 ? 7 : 8;
  const likes = new Set(a.likes);
  const picked = [];
  const hit = new Set();
  while (picked.length < maxEx) {
    const open = Object.keys(need).filter((m) => need[m] >= 1);
    if (!open.length) break;
    const prio = (m) => need[m] * (ctx.focus.has(m) ? 1.3 : 1) * (hit.has(m) ? 0.8 : 1);
    const m = open.reduce((best, x) => (prio(x) > prio(best) ? x : best), open[0]);
    const perMuscle = picked.filter((p) => primary(p.base) === m).length;
    const cands = perMuscle >= (ctx.focus.has(m) ? 3 : 2) ? [] : ctx.pool.filter((e) => primary(e) === m && !picked.some((p) => p.base.id === e.id));
    if (!cands.length) { need[m] = 0; continue; }
    const score = (e) => {
      let s = 0;
      if (likes.has(e.id)) s += 50;
      if (!hit.has(m)) s += isCompound(e) ? 12 : 0; else s += isCompound(e) ? 0 : 6;
      if (usedElsewhere.has(e.id)) s -= 15;
      if (TIRING.includes(e.id) && a.goal !== "kracht") s -= 10;
      if ((a.goal === "kracht" || a.goal === "beide") && STRONG.includes(e.id)) s += 8;
      for (const [k, w] of Object.entries(e.muscles)) if (k !== m && need[k] > 0) s += Math.min(need[k], 4) * w;
      return s;
    };
    const e = cands.reduce((best, x) => (score(x) > score(best) ? x : best), cands[0]);
    const sets = Math.min(4, Math.max(2, Math.round(need[m])));
    picked.push({ base: e, sets });
    hit.add(m);
    for (const [k, w] of Object.entries(e.muscles)) if (need[k] != null) need[k] -= sets * w;
  }
  // Heavy multi-joint lifts first, focus muscles before the rest.
  const strength = a.goal === "kracht" || a.goal === "beide";
  const order = (p) => (isCompound(p.base) ? 0 : 10) + (strength && !STRONG.includes(p.base.id) ? 5 : 0) + (ctx.focus.has(primary(p.base)) ? 0 : 1);
  picked.sort((x, y) => order(x) - order(y));
  let firstC = true;
  let list = picked.map(({ base, sets }) => {
    const d = dose(base, a, isCompound(base) && firstC);
    if (isCompound(base)) firstC = false;
    return { ...base, cue: "", sets, ...d, dropSets: 0, supersetWithNext: false };
  });
  list = applyTechniques(list, a, ctx.focus);
  return fitTime(list, a, ctx.focus);
}

/** Supersets pair two isolation lifts for different muscles; one drop set on the last isolation lift (S.adv, S.drop). */
function applyTechniques(list, a, focus) {
  const out = list.map((e) => ({ ...e }));
  if (a.supersets) {
    for (let i = 0; i < out.length - 1; i++) {
      const x = out[i], y = out[i + 1];
      if (!isCompound(x) && !isCompound(y) && primary(x) !== primary(y) && !(i > 0 && out[i - 1].supersetWithNext)) { x.supersetWithNext = true; i++; }
    }
  }
  if (a.dropsets && a.level !== "nieuw") {
    const iso = out.filter((e) => !isCompound(e));
    const target = [...iso].reverse().find((e) => focus.has(primary(e))) || iso[iso.length - 1];
    if (target) target.dropSets = 1;
  }
  return out;
}

/** Too long? First trim sets of non-focus lifts, then drop the last non-focus isolation lift (S.time). */
function fitTime(list, a, focus) {
  let out = list.map((e) => ({ ...e }));
  let guard = 40;
  while (minutesOf(out) > a.minutes && guard-- > 0) {
    const nonFocus = out.filter((e) => !focus.has(primary(e)));
    const trim = [...(nonFocus.length ? nonFocus : out)].sort((x, y) => y.sets - x.sets).find((e) => e.sets > 2);
    if (trim) { trim.sets -= 1; continue; }
    if (out.length <= 3) break;
    const drop = [...out].reverse().find((e) => !isCompound(e) && !focus.has(primary(e))) || out[out.length - 1];
    const i = out.indexOf(drop);
    if (i > 0 && out[i - 1].supersetWithNext) out[i - 1].supersetWithNext = false;
    out.splice(i, 1);
  }
  if (out.length) out[out.length - 1].supersetWithNext = false;
  return out;
}

/** The whole program, plus a short explanation of why it looks this way. */
export function generate(a) {
  const { targets, focus } = weeklyTargets(a);
  const types = splitFor(a);
  const names = dayNames(types, a);
  const ctx = { targets, focus, pool: pool(a) };
  const count = {};
  types.forEach((t) => DAY_MUSCLES[t].forEach((m) => (count[m] = (count[m] || 0) + 1)));
  const share = Object.fromEntries(Object.keys(count).map((m) => [m, 1 / count[m]]));
  const used = new Set();
  const days = types.map((t, i) => {
    const exercises = buildDay(t, share, ctx, a, used);
    exercises.forEach((e) => used.add(e.id));
    return { id: "g" + (i + 1), name: names[i], exercises };
  });
  const focusName = a.focus.map((f) => FOCUS[f].toLowerCase()).join(" + ");
  const program = {
    name: `${GOALS[a.goal]}${focusName ? " · " + focusName : ""} · ${a.days} ${a.days === 1 ? "dag" : "dagen"}`,
    days, weeklyTarget: a.days, buildUp: false,
  };
  return { program, summary: summarize(program, a, targets, focus) };
}

function summarize(program, a, targets, focus) {
  const sets = {};
  for (const d of program.days) for (const e of d.exercises) for (const [m, w] of Object.entries(e.muscles)) sets[m] = (sets[m] || 0) + w * e.sets;
  const mins = program.days.map((d) => minutesOf(d.exercises));
  const lines = [
    `${program.days.length} ${program.days.length === 1 ? "training" : "trainingen"} per week: ${program.days.map((d) => d.name).join(", ")}. Elke spier komt ${program.days.length >= 2 ? "minstens 2× per week" : "1× per week"} aan de beurt [1, 2].`,
    `± ${Math.min(...mins) === Math.max(...mins) ? Math.max(...mins) : `${Math.min(...mins)}–${Math.max(...mins)}`} min per training, binnen je ${a.minutes} minuten.`,
  ];
  if (focus.size) {
    const f = [...focus].filter((m) => sets[m]).map((m) => `${(MUSCLES[m] || m).toLowerCase()} ${Math.round(sets[m])}`).join(", ");
    lines.push(`Extra volume voor je focus (sets per week): ${f}. De rest krijgt genoeg om te groeien of te behouden [4, ${S.maint}].`);
  } else lines.push(`Ongeveer ${targets.rug} sets per week voor de grote spiergroepen, passend bij je ervaring [4, 5].`);
  const comp = program.days.flatMap((d) => d.exercises).find((e) => e.rest >= 120);
  if (comp) lines.push(a.goal === "kracht" || a.goal === "beide" ? `Zware basisoefening eerst met 3–6 herhalingen en ruime rust, daarna spierwerk [${S.cont}, 8].` : `Herhalingen tussen 5 en 20 werken allemaal voor spiergroei, zolang je dicht bij falen komt [${S.cont}, 6].`);
  if (a.supersets || a.dropsets) lines.push(`Supersets en dropsets besparen tijd met vergelijkbare groei; ze komen alleen bij isolatie-oefeningen [${S.adv}, ${S.drop}].`);
  if (a.injuries.length) lines.push("Oefeningen die je klacht kunnen prikkelen zijn vervangen. Houdt de pijn aan, overleg dan met een fysiotherapeut.");
  if (a.minutes < 45) lines.push(`Korte trainingen werken prima als je de sets dicht bij falen doet [${S.time}].`);
  return lines;
}

// ---------- sharing ----------
const SHARE_PREFIX = "FITSCHEMA1:";
const KEEP = ["id", "name", "cue", "sets", "repMin", "repMax", "inc", "bodyweight", "muscles", "rest", "rir", "dropSets", "supersetWithNext"];

/** A schema as readable text plus a code another Fitman app can paste in. */
export function shareTextOf(program) {
  const lines = [program.name, ""];
  for (const d of program.days) {
    lines.push(d.name.toUpperCase());
    for (const e of d.exercises) lines.push(`- ${e.name}: ${e.sets} × ${e.bodyweight ? "AMRAP" : `${e.repMin}–${e.repMax}`}${e.rir != null ? `, ${e.rir} RIR` : ""}${e.dropSets ? `, +${e.dropSets} drop` : ""}${e.supersetWithNext ? " (superset met volgende)" : ""}`);
    lines.push("");
  }
  const slim = { name: program.name, weeklyTarget: program.weeklyTarget, days: program.days.map((d) => ({ id: d.id, name: d.name, exercises: d.exercises.map((e) => Object.fromEntries(KEEP.map((k) => [k, e[k]]))) })) };
  const code = SHARE_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(slim))));
  lines.push("Overnemen in Fitman of Fit Woman: kopieer de code hieronder en kies Schema > Mijn schema's > Code plakken.", "", code);
  return lines.join("\n");
}

/** Reads a pasted share text or code; null when it is not a schema. */
export function parseShared(text) {
  const m = String(text || "").match(/FITSCHEMA1:([A-Za-z0-9+/=]+)/);
  if (!m) return null;
  try {
    const p = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
    if (!Array.isArray(p.days) || !p.days.length) return null;
    const lib = Object.fromEntries(LIBRARY.map((e) => [e.id, e]));
    return {
      name: String(p.name || "Gedeeld schema").slice(0, 60), weeklyTarget: p.weeklyTarget ?? p.days.length, buildUp: false,
      days: p.days.slice(0, 7).map((d, i) => ({
        id: String(d.id || "s" + i), name: String(d.name || `Dag ${i + 1}`).slice(0, 24),
        exercises: (d.exercises || []).map((e) => ({ ...(lib[e.id] || {}), ...e, tip: e.tip || lib[e.id]?.tip || "", src: e.src?.length ? e.src : lib[e.id]?.src || [], cue: String(e.cue || "").slice(0, 60), rir: e.rir ?? null, dropSets: e.dropSets || 0, supersetWithNext: !!e.supersetWithNext })),
      })),
    };
  } catch { return null; }
}
