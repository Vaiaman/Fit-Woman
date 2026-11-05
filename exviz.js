// Exercise drawings for Fitman: own pictogram figures, drawn from joint angles, so every
// exercise gets a picture in the same style, in the app's colours, offline and free to share.
// A pose is a set of absolute segment angles in degrees: 0 points down, 90 forward (to the
// right, where the figure faces), 180 up and 270 backwards. The start and end pose are tweened
// on the angles, which keeps limbs the same length while they move.
import { POSES } from "./poses.js";

const LEN = { t: 28, neck: 3, head: 5.5, ua: 15, fa: 14, th: 22, sh: 21, ft: 7 };
const rad = (a) => (a * Math.PI) / 180;
const dir = (a, l) => [Math.sin(rad(a)) * l, Math.cos(rad(a)) * l];
const add = (p, v) => [p[0] + v[0], p[1] + v[1]];
const r1 = (n) => Math.round(n * 10) / 10;

/** Side view: joint positions from a pose, anchored at the joint named in `at`. */
function sideJoints(p) {
  const j = { hip: [0, 0] };
  j.sho = add(j.hip, dir(p.t, LEN.t));
  j.neck = add(j.sho, dir(p.hd ?? p.t, LEN.neck));
  j.head = add(j.neck, dir(p.hd ?? p.t, LEN.head));
  j.elb = add(j.sho, dir(p.ua, LEN.ua));
  j.hand = add(j.elb, dir(p.fa, LEN.fa));
  j.knee = add(j.hip, dir(p.th, LEN.th));
  j.ank = add(j.knee, dir(p.sh, LEN.sh));
  j.toe = add(j.ank, dir(p.ft ?? p.sh + 90, LEN.ft));
  if (p.ua2 != null) { j.elb2 = add(j.sho, dir(p.ua2, LEN.ua)); j.hand2 = add(j.elb2, dir(p.fa2, LEN.fa)); }
  if (p.th2 != null) { j.knee2 = add(j.hip, dir(p.th2, LEN.th)); j.ank2 = add(j.knee2, dir(p.sh2, LEN.sh)); j.toe2 = add(j.ank2, dir(p.ft2 ?? p.sh2 + 90, LEN.ft)); }
  const [name, x, y] = p.at || ["hip", 60, 50];
  const off = [x - j[name][0], y - j[name][1]];
  for (const k in j) j[k] = add(j[k], off);
  return j;
}

/** Front view (for raises and flies): a symmetric figure. Limbs point in 3D: e is elevation
 * (0 level, -90 down, 90 up) and h the horizontal angle (0 towards you, 90 out to the side),
 * projected flat, so an arm that swings towards you gets shorter on screen. */
const proj = (e, h, l) => [Math.cos(rad(e)) * Math.sin(rad(h)) * l, -Math.sin(rad(e)) * l];
function frontJoints(p) {
  const j = {};
  const [, x, y] = p.at || ["hip", 60, 49];
  j.hip = [x, y];
  j.neck = [x, y - LEN.t - 1];
  j.head = [x, y - LEN.t - 1 - LEN.neck - LEN.head];
  for (const s of [1, -1]) {
    const k = s > 0 ? "R" : "L";
    const m = (v) => [v[0] * s, v[1]];
    j["sho" + k] = [x + s * 9, y - LEN.t + 1];
    j["elb" + k] = add(j["sho" + k], m(proj(p.ue ?? -86, p.uh ?? 90, LEN.ua)));
    j["hand" + k] = add(j["elb" + k], m(proj(p.fe ?? p.ue ?? -86, p.fh ?? p.uh ?? 90, LEN.fa)));
    j["hip" + k] = [x + s * 5, y];
    j["knee" + k] = add(j["hip" + k], m(proj(p.te ?? -86, p.thh ?? 90, LEN.th)));
    j["ank" + k] = add(j["knee" + k], m(proj(p.se ?? -90, p.shh ?? 90, LEN.sh)));
  }
  return j;
}

const lerp = (a, b, t) => a + (b - a) * t;
function tween(a, b, t) {
  const o = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (k === "at") o.at = [a.at?.[0] || b.at?.[0], lerp(a.at?.[1] ?? b.at[1], b.at?.[1] ?? a.at[1], t), lerp(a.at?.[2] ?? b.at[2], b.at?.[2] ?? a.at[2], t)];
    else if (typeof (a[k] ?? b[k]) === "number") o[k] = lerp(a[k] ?? b[k], b[k] ?? a[k], t);
  }
  return o;
}

/** Elements as [tag, attrs(joints), class]; attrs may change per frame, which becomes an SMIL animation. */
function sideParts(def, p0) {
  const L = (a, b, cls) => ["line", (j) => j[a] && j[b] ? { x1: j[a][0], y1: j[a][1], x2: j[b][0], y2: j[b][1] } : null, cls];
  const parts = [];
  if (p0.ua2 != null) parts.push(L("sho", "elb2", "far"), L("elb2", "hand2", "far"));
  if (p0.th2 != null) parts.push(L("hip", "knee2", "far"), L("knee2", "ank2", "far"), L("ank2", "toe2", "far ft"));
  parts.push(L("hip", "knee", "lb"), L("knee", "ank", "lb"), L("ank", "toe", "lb ft"));
  parts.push(L("hip", "sho", "tr"), L("sho", "neck", "lb nk"));
  parts.push(["circle", (j) => ({ cx: j.head[0], cy: j.head[1], r: LEN.head }), "hd"]);
  parts.push(L("sho", "elb", "lb"), L("elb", "hand", "lb"));
  return parts;
}
function frontParts() {
  const L = (a, b, cls) => ["line", (j) => ({ x1: j[a][0], y1: j[a][1], x2: j[b][0], y2: j[b][1] }), cls];
  const parts = [];
  for (const k of ["L", "R"]) parts.push(L("hip" + k, "knee" + k, "lb"), L("knee" + k, "ank" + k, "lb"));
  parts.push(["path", (j) => ({ d: `M${r1(j.shoL[0] - 2)} ${r1(j.shoL[1] - 1)}L${r1(j.shoR[0] + 2)} ${r1(j.shoR[1] - 1)}L${r1(j.hipR[0] + 2)} ${r1(j.hipR[1] + 2)}L${r1(j.hipL[0] - 2)} ${r1(j.hipL[1] + 2)}Z` }), "body"]);
  parts.push(L("neck", "head", "lb nk"), ["circle", (j) => ({ cx: j.head[0], cy: j.head[1], r: LEN.head }), "hd"]);
  for (const k of ["L", "R"]) parts.push(L("sho" + k, "elb" + k, "lb"), L("elb" + k, "hand" + k, "lb"));
  return parts;
}

/** Loads that move with a joint: dumbbell, barbell plate, machine handle or pad, with an optional cable to a fixed pulley. */
function loadParts(def) {
  const out = [];
  for (const ld of def.load || []) {
    const pts = def.v === "front" ? [ld.at + "L", ld.at + "R"] : [ld.at];
    for (const at of pts) {
      if (ld.cable) {
        const from = def.v === "front" && at.endsWith("L") ? [120 - ld.cable[0], ld.cable[1]] : ld.cable;
        out.push(["line", (j) => ({ x1: from[0], y1: from[1], x2: j[at][0], y2: j[at][1] }), "cable"]);
        out.push(["circle", () => ({ cx: from[0], cy: from[1], r: 2.6 }), "eqf"]);
      }
      if (ld.k === "back") { out.push(["line", (j) => seg(j, "hip", "sho", ld.off ?? 6, 3, 6), "padm"]); continue; }
      if (ld.k === "foot") { out.push(["line", (j) => seg(j, "ank", "toe", -4.5, 5, 7), "padm"]); continue; }
      const r = { bb: 7.5, db: 4.2, h: 2.6, pad: 3.6, plate: 6 }[ld.k] || 3;
      out.push(["circle", (j) => ({ cx: j[at][0], cy: j[at][1], r }), "load " + ld.k]);
    }
  }
  return out;
}

/** A line alongside the segment a→b, shifted sideways by off and lengthened by e0/e1 at the ends. */
function seg(j, a, b, off, e0, e1) {
  const A = j[a], B = j[b];
  const len = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
  const u = [(B[0] - A[0]) / len, (B[1] - A[1]) / len];
  const n = [u[1], -u[0]];
  return { x1: A[0] - u[0] * e0 + n[0] * off, y1: A[1] - u[1] * e0 + n[1] * off, x2: B[0] + u[0] * e1 + n[0] * off, y2: B[1] + u[1] * e1 + n[1] * off };
}

const FRAMES = 12;
const ease = (k) => (1 - Math.cos((Math.PI * k) / FRAMES)) / 2;

function staticEq(def, j) {
  return (def.eq || []).map((e) => {
    if (e.seg) { const a = seg(j, e.seg[0], e.seg[1], e.off ?? 6, e.ext?.[0] ?? 0, e.ext?.[1] ?? 0); return `<line ${attrs(a)} class="eq" style="stroke-width:${e.w || 5}"/>`; }
    if (e.l) return `<line x1="${e.l[0]}" y1="${e.l[1]}" x2="${e.l[2]}" y2="${e.l[3]}" class="eq" style="stroke-width:${e.w || 4}"/>`;
    if (e.p) return `<polyline points="${e.p.join(" ")}" class="eq" style="stroke-width:${e.w || 4}"/>`;
    if (e.c) return `<circle cx="${e.c[0]}" cy="${e.c[1]}" r="${e.c[2]}" class="eqf"/>`;
    return "";
  }).join("");
}

function attrs(o) { return Object.entries(o).map(([k, v]) => `${k}="${typeof v === "number" ? r1(v) : v}"`).join(" "); }

/** One drawing. animate=false gives start and end next to each other, for reduced motion. */
export function exerciseSvg(id, { animate = true } = {}) {
  const def = POSES[id];
  if (!def) return "";
  const solve = def.v === "front" ? frontJoints : sideJoints;
  const parts = [...(def.v === "front" ? frontParts() : sideParts(def, def.a)), ...loadParts(def)];
  const j0 = solve(def.a);
  const floor = def.floor === false ? "" : `<line x1="4" y1="96" x2="116" y2="96" class="floor"/>`;
  const draw = (pose, extra = "") => {
    const j = solve(pose);
    return parts.map(([tag, f, cls]) => { const a = f(j); return a ? `<${tag} ${attrs(a)} class="${cls}"/>` : ""; }).join("");
  };
  if (!animate) {
    return `<svg viewBox="0 -12 240 110" class="exviz" role="img" aria-label="Begin- en eindhouding">
      <g>${floor}${staticEq(def, j0)}${draw(def.a)}</g><g transform="translate(120 0)">${floor}${staticEq(def, j0)}${draw(def.b)}</g>
      <text x="8" y="-2" class="cap">Start</text><text x="128" y="-2" class="cap">Eind</text></svg>`;
  }
  const frames = [];
  for (let k = 0; k <= FRAMES; k++) frames.push(solve(tween(def.a, def.b, ease(k))));
  const seq = [...frames, ...frames.slice(0, -1).reverse()];
  const dur = def.dur || 3.2;
  const body = parts.map(([tag, f, cls]) => {
    const vals = seq.map(f);
    if (!vals[0]) return "";
    const first = vals[0];
    let anim = "";
    for (const k of Object.keys(first)) {
      const list = vals.map((v) => (typeof v[k] === "number" ? r1(v[k]) : v[k]));
      if (list.every((x) => x === list[0])) continue;
      anim += `<animate attributeName="${k}" dur="${dur}s" repeatCount="indefinite" values="${list.join(";")}"/>`;
    }
    return anim ? `<${tag} ${attrs(first)} class="${cls}">${anim}</${tag}>` : `<${tag} ${attrs(first)} class="${cls}"/>`;
  }).join("");
  return `<svg viewBox="0 -12 120 110" class="exviz" role="img" aria-label="Bewegingsanimatie">${floor}${staticEq(def, j0)}${body}</svg>`;
}

export const hasDrawing = (id) => !!POSES[id];
