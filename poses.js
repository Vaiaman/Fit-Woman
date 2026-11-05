// Start (a) and end (b) poses for every exercise in the library, drawn by exviz.js.
// Angles in degrees: 0 down, 90 forward, 180 up, 270 (or -90) backwards. `at` pins one joint
// to a point in the 120 × 100 drawing; the floor is at y 96. Front-view poses use elevation
// (e) and horizontal angle (h) per limb instead, see exviz.js.
const DB = [{ k: "db", at: "hand" }];
const BB = [{ k: "bb", at: "hand" }];
const H = [{ k: "h", at: "hand" }];
const cable = (x, y, k = "h") => [{ k, at: "hand", cable: [x, y] }];

// Shared shapes
const benchBack = { seg: ["hip", "sho"], off: 6, ext: [6, 10] };
const seatLegs = (x, y) => [{ l: [x - 12, y, x + 12, y] }, { l: [x, y, x, 96], w: 3 }];
const flatBench = [{ l: [26, 70, 86, 70], w: 5 }, { l: [34, 70, 34, 96], w: 3 }, { l: [78, 70, 78, 96], w: 3 }];
const standing = { t: 180, th: 0, sh: 0, ua: 0, fa: 0, at: ["ank", 58, 92] };

const lyingPress = (load, arms = { a: { ua: 50, fa: 178 }, b: { ua: 178, fa: 180 } }) => ({
  eq: flatBench, load,
  a: { t: 270, th: 70, sh: -10, at: ["hip", 76, 64], ...arms.a },
  b: { t: 270, th: 70, sh: -10, at: ["hip", 76, 64], ...arms.b },
});
const inclinePress = (load) => ({
  eq: [benchBack, ...seatLegs(78, 75)], load,
  a: { t: 232, th: 85, sh: 8, ua: 40, fa: 172, at: ["hip", 74, 69] },
  b: { t: 232, th: 85, sh: 8, ua: 172, fa: 176, at: ["hip", 74, 69] },
});
const seatedPress = (load) => ({
  eq: [{ seg: ["hip", "sho"], off: 6, ext: [4, 4] }, ...seatLegs(52, 75)], load,
  a: { t: 182, th: 90, sh: 4, ua: 12, fa: 172, at: ["hip", 52, 70] },
  b: { t: 182, th: 90, sh: 4, ua: 178, fa: 180, at: ["hip", 52, 70] },
});
const frontRaise = (load, extra = {}) => ({
  v: "front", load,
  a: { ue: -82, uh: 85, fe: -84, fh: 85, ...extra },
  b: { ue: -2, uh: 85, fe: 2, fh: 85, ...extra },
});
const flyFront = (load, ue = -8) => ({
  v: "front", load,
  a: { ue, uh: 92, fe: ue, fh: 100 },
  b: { ue, uh: 22, fe: ue, fh: -12 },
});
const reverseFly = (load) => ({
  v: "front", load,
  a: { ue: 0, uh: 14, fe: 0, fh: 4 },
  b: { ue: 0, uh: 95, fe: 0, fh: 98 },
});
const curl = (load, extra = {}) => ({
  load,
  a: { ...standing, ua: 2, fa: 0, ...extra },
  b: { ...standing, ua: 12, fa: 150, ...extra },
});
const legPress = {
  eq: [{ seg: ["hip", "sho"], off: 6, ext: [4, 6] }, { l: [30, 82, 52, 82] }, { l: [40, 82, 40, 96], w: 3 }],
  load: [{ k: "foot", at: "ank" }],
  a: { t: 232, th: 150, sh: 62, ua: 40, fa: 80, at: ["hip", 44, 78] },
  b: { t: 232, th: 122, sh: 120, ua: 40, fa: 80, at: ["hip", 44, 78] },
};
const hipThrust = (load, eq = [{ l: [16, 75, 44, 75], w: 5 }, { l: [24, 75, 24, 96], w: 3 }]) => ({
  eq, load,
  a: { t: 250, th: 118, sh: -8, ua: 30, fa: 100, at: ["ank", 88, 92] },
  b: { t: 270, th: 90, sh: 0, ua: 50, fa: 90, at: ["ank", 88, 92] },
});

export const POSES = {
  // Chest
  "incline-db-press": inclinePress(DB),
  "incline-sm-press": inclinePress(BB),
  "flat-db-press": lyingPress(DB),
  "barbell-bench-press": lyingPress(BB),
  "flat-chest-press-machine": {
    eq: [{ seg: ["hip", "sho"], off: 6, ext: [4, 4] }, ...seatLegs(52, 75)], load: H,
    a: { t: 186, th: 90, sh: 4, ua: -40, fa: 86, at: ["hip", 52, 70] },
    b: { t: 186, th: 90, sh: 4, ua: 86, fa: 88, at: ["hip", 52, 70] },
  },
  "chest-fly": flyFront(DB, -6),
  "pec-deck": flyFront([{ k: "pad", at: "elb" }], 0),
  "cable-fly": flyFront(cable(112, 6), -18),
  dips: {
    floor: false, eq: [{ l: [46, 52, 76, 52], w: 4 }, { l: [70, 52, 70, 96], w: 3 }],
    a: { t: 174, ua: 2, fa: 0, th: 12, sh: -70, at: ["hand", 60, 52] },
    b: { t: 150, ua: -62, fa: 8, th: 30, sh: -60, at: ["hand", 60, 52] },
  },
  "push-up": {
    a: { t: 110, ua: 0, fa: 0, th: -70, sh: -70, ft: 20, at: ["hand", 76, 92] },
    b: { t: 100, ua: -100, fa: 0, th: -80, sh: -80, ft: 10, at: ["hand", 76, 92] },
  },

  // Back
  "chest-supported-row": {
    eq: [{ seg: ["hip", "sho"], off: 6, ext: [-6, 4] }, { l: [58, 62, 66, 96], w: 3 }], load: DB,
    a: { t: 125, th: 20, sh: -8, ua: 4, fa: 2, at: ["ank", 40, 92] },
    b: { t: 125, th: 20, sh: -8, ua: -88, fa: 4, at: ["ank", 40, 92] },
  },
  "pull-ups": {
    floor: false, eq: [{ l: [40, 2, 88, 2], w: 4 }],
    a: { t: 182, ua: 166, fa: 172, th: 14, sh: -70, at: ["hand", 66, 2] },
    b: { t: 176, ua: 16, fa: 172, th: 14, sh: -70, at: ["hand", 66, 2] },
  },
  "lat-pulldown": {
    eq: [...seatLegs(52, 76), { c: [76, 63, 4] }], load: cable(57, 2),
    a: { t: 184, th: 90, sh: 0, ua: 170, fa: 176, at: ["hip", 52, 70] },
    b: { t: 192, th: 90, sh: 0, ua: -20, fa: 160, at: ["hip", 52, 70] },
  },
  "seated-cable-row": {
    eq: [{ l: [24, 86, 56, 86], w: 4 }, { l: [94, 66, 94, 92], w: 4 }], load: cable(110, 80),
    a: { t: 160, th: 84, sh: 96, ft: 182, ua: 84, fa: 86, at: ["hip", 40, 80] },
    b: { t: 186, th: 84, sh: 96, ft: 182, ua: -40, fa: 84, at: ["hip", 40, 80] },
  },
  "single-arm-cable-row": {
    load: cable(112, 56),
    a: { t: 160, th: 14, sh: -6, th2: -14, sh2: -2, ua: 92, fa: 92, at: ["ank", 50, 92] },
    b: { t: 178, th: 14, sh: -6, th2: -14, sh2: -2, ua: -50, fa: 86, at: ["ank", 50, 92] },
  },
  "machine-row": {
    eq: [{ l: [54, 32, 54, 56], w: 5 }, ...seatLegs(44, 76)], load: H,
    a: { t: 180, th: 90, sh: 4, ua: 88, fa: 90, at: ["hip", 44, 70] },
    b: { t: 182, th: 90, sh: 4, ua: -46, fa: 84, at: ["hip", 44, 70] },
  },
  "one-arm-db-row": {
    eq: [{ l: [14, 83, 82, 83], w: 5 }, { l: [22, 83, 22, 96], w: 3 }, { l: [74, 83, 74, 96], w: 3 }], load: DB,
    a: { t: 96, th: 0, sh: -90, ft: 0, th2: 12, sh2: -4, ua2: 0, fa2: 0, ua: 4, fa: 0, at: ["hip", 40, 57] },
    b: { t: 96, th: 0, sh: -90, ft: 0, th2: 12, sh2: -4, ua2: 0, fa2: 0, ua: -100, fa: 4, at: ["hip", 40, 57] },
  },
  "barbell-row": {
    load: BB,
    a: { t: 112, th: 28, sh: -10, ua: 0, fa: 0, at: ["ank", 56, 92] },
    b: { t: 112, th: 28, sh: -10, ua: -82, fa: 8, at: ["ank", 56, 92] },
  },
  "inverted-row": {
    eq: [{ l: [66, 26, 98, 26], w: 4 }, { l: [94, 26, 94, 96], w: 3 }],
    a: { t: 125, ua: 180, fa: 180, th: -55, sh: -55, ft: 35, at: ["hand", 80, 26] },
    b: { t: 125, ua: -40, fa: 160, th: -55, sh: -55, ft: 35, at: ["hand", 80, 26] },
  },
  "straight-arm-pulldown": {
    load: cable(100, 4),
    a: { t: 162, th: 10, sh: -6, ua: 150, fa: 152, at: ["ank", 50, 92] },
    b: { t: 162, th: 10, sh: -6, ua: -8, fa: -8, at: ["ank", 50, 92] },
  },
  facepulls: {
    v: "front", load: H,
    a: { ue: 2, uh: 8, fe: 2, fh: 4 },
    b: { ue: 4, uh: 92, fe: 86, fh: 90 },
  },
  "reverse-pec-deck": reverseFly(H),
  "rear-delt-cable-fly": reverseFly(H),

  // Legs
  "barbell-squat": {
    load: [{ k: "bb", at: "sho" }],
    a: { ...standing, ua: -40, fa: 150 },
    b: { ...standing, t: 142, th: 84, sh: -36, ua: -10, fa: 120 },
  },
  "smith-squat": {
    load: [{ k: "bb", at: "sho" }],
    a: { ...standing, at: ["ank", 64, 92], sh: 8, th: -4, ua: -40, fa: 150 },
    b: { ...standing, at: ["ank", 64, 92], t: 160, th: 86, sh: -14, ua: -16, fa: 128 },
  },
  "goblet-squat": {
    load: DB,
    a: { ...standing, ua: 14, fa: 160 },
    b: { ...standing, t: 158, th: 86, sh: -32, ua: 40, fa: 160 },
  },
  "hack-squat": {
    load: [{ k: "back", at: "hip" }], eq: [{ l: [62, 94, 92, 82], w: 4 }],
    a: { t: 198, th: 24, sh: 22, ft: 100, ua: 20, fa: 120, at: ["ank", 76, 86] },
    b: { t: 200, th: 100, sh: -4, ft: 100, ua: 40, fa: 110, at: ["ank", 76, 86] },
  },
  "leg-press": legPress,
  "bulgarian-split-squat": {
    eq: [{ l: [6, 72, 30, 72], w: 5 }, { l: [14, 72, 14, 96], w: 3 }], load: DB,
    a: { t: 180, th: 6, sh: 0, th2: -34, sh2: -108, ft2: -10, ua: 0, fa: 0, at: ["ank", 64, 92] },
    b: { t: 172, th: 80, sh: -16, th2: -6, sh2: -98, ft2: -10, ua: 2, fa: 0, at: ["ank", 64, 92] },
  },
  "walking-lunge": {
    load: DB,
    a: { ...standing, at: ["ank", 66, 92], th: 4, th2: -6, sh2: 0 },
    b: { ...standing, at: ["ank", 66, 92], t: 178, th: 78, sh: -12, th2: -20, sh2: -96, ft2: -12 },
  },
  "reverse-lunge": {
    load: DB,
    a: { ...standing, at: ["ank", 66, 92], th: 2, th2: 0, sh2: 0 },
    b: { ...standing, at: ["ank", 66, 92], t: 172, th: 82, sh: -12, th2: -20, sh2: -96, ft2: -12 },
  },
  "step-up": {
    eq: [{ p: [58, 96, 58, 82, 92, 82, 92, 96], w: 4 }], load: DB,
    a: { t: 168, th: 62, sh: -14, th2: -8, sh2: 0, ua: 0, fa: 0, at: ["ank", 76, 78] },
    b: { t: 180, th: 0, sh: 0, th2: -4, sh2: -40, ua: 0, fa: 0, at: ["ank", 76, 78] },
  },
  "leg-extension": {
    eq: [{ seg: ["hip", "sho"], off: 6, ext: [4, 2] }, ...seatLegs(50, 72)], load: [{ k: "pad", at: "ank" }],
    a: { t: 188, th: 90, sh: 4, ua: 0, fa: 20, at: ["hip", 50, 67] },
    b: { t: 188, th: 90, sh: 84, ua: 0, fa: 20, at: ["hip", 50, 67] },
  },
  "romanian-deadlift": {
    load: BB,
    a: { ...standing },
    b: { ...standing, t: 104, th: 14, sh: -6 },
  },
  deadlift: {
    load: BB,
    a: { ...standing, t: 128, th: 66, sh: -24 },
    b: { ...standing },
  },
  "seated-leg-curl": {
    eq: [{ seg: ["hip", "sho"], off: 6, ext: [4, 2] }, ...seatLegs(50, 72), { c: [72, 60, 3.6] }], load: [{ k: "pad", at: "ank" }],
    a: { t: 192, th: 90, sh: 84, ua: 0, fa: 30, at: ["hip", 50, 67] },
    b: { t: 192, th: 90, sh: -24, ua: 0, fa: 30, at: ["hip", 50, 67] },
  },
  "lying-leg-curl": {
    eq: [{ l: [10, 78, 100, 78], w: 5 }, { l: [20, 78, 20, 96], w: 3 }, { l: [90, 78, 90, 96], w: 3 }], load: [{ k: "pad", at: "ank" }],
    a: { t: 90, th: -90, sh: -90, ft: 0, ua: 140, fa: 110, hd: 80, at: ["hip", 48, 71] },
    b: { t: 90, th: -90, sh: -192, ft: -100, ua: 140, fa: 110, hd: 80, at: ["hip", 48, 71] },
  },
  "nordic-curl": {
    eq: [{ l: [20, 93, 60, 93], w: 4 }, { c: [30, 85, 3.4] }],
    a: { t: 180, th: 0, sh: -90, ft: 0, ua: 20, fa: 150, at: ["ank", 30, 90] },
    b: { t: 128, th: -52, sh: -90, ft: 0, ua: 70, fa: 70, at: ["ank", 30, 90] },
  },
  "back-extension-45": {
    eq: [{ l: [42, 75, 57, 60], w: 6 }, { l: [20, 92, 24, 88], w: 4 }, { l: [49, 68, 49, 96], w: 3 }],
    a: { t: 135, th: -45, sh: -45, ft: 45, ua: -20, fa: 130, at: ["ank", 22, 86] },
    b: { t: 16, th: -45, sh: -45, ft: 45, ua: -120, fa: 30, at: ["ank", 22, 86] },
  },
  "hip-thrust": hipThrust([{ k: "bb", at: "hip" }]),
  "hip-thrust-machine": hipThrust([{ k: "pad", at: "hip" }], [{ l: [16, 75, 44, 75], w: 5 }, { l: [24, 75, 24, 96], w: 3 }, { l: [94, 96, 94, 70], w: 3 }]),
  "glute-bridge": {
    load: [{ k: "db", at: "hip" }],
    a: { t: 270, th: 142, sh: 14, ua: 30, fa: 60, at: ["sho", 30, 90] },
    b: { t: 288, th: 104, sh: -8, ua: 30, fa: 70, at: ["sho", 30, 90] },
  },
  "hip-abduction": {
    v: "front", eq: [{ l: [34, 76, 86, 76], w: 5 }, { l: [60, 76, 60, 96], w: 3 }], load: [{ k: "pad", at: "knee" }],
    a: { at: ["hip", 60, 72], te: -4, thh: 10, se: -90, ue: -70, uh: 80 },
    b: { at: ["hip", 60, 72], te: -4, thh: 42, se: -90, shh: 110, ue: -70, uh: 80 },
  },
  "cable-kickback": {
    load: [{ k: "pad", at: "ank", cable: [104, 92] }],
    a: { t: 150, th: 8, sh: 4, th2: 4, sh2: 0, ua: 100, fa: 96, at: ["ank2", 58, 92] },
    b: { t: 150, th: -48, sh: -36, th2: 4, sh2: 0, ua: 100, fa: 96, at: ["ank2", 58, 92] },
  },
  "walking-lunge-db": null,

  // Calves
  "standing-calf-raise": {
    eq: [{ p: [50, 96, 50, 90, 80, 90, 80, 96], w: 3 }], load: DB,
    a: { ...standing, ft: 108, at: ["toe", 66, 87] },
    b: { ...standing, ft: 50, at: ["toe", 66, 87] },
  },
  "seated-calf-raise": {
    eq: [...seatLegs(44, 66), { p: [64, 96, 64, 91, 90, 91, 90, 96], w: 3 }], load: [{ k: "pad", at: "knee" }],
    a: { t: 180, th: 90, sh: 0, ft: 110, ua: 50, fa: 90, at: ["toe", 80, 88] },
    b: { t: 180, th: 100, sh: 6, ft: 56, ua: 50, fa: 90, at: ["toe", 80, 88] },
  },
  "leg-press-calf-raise": {
    ...legPress,
    a: { ...legPress.b, ft: 230 },
    b: { ...legPress.b, ft: 180 },
  },

  // Shoulders
  "shoulder-press-db": seatedPress(DB),
  "machine-shoulder-press": seatedPress(H),
  "smith-shoulder-press": seatedPress(BB),
  "overhead-press": { load: BB, a: { ...standing, ua: 18, fa: 172 }, b: { ...standing, ua: 178, fa: 180 } },
  "butterfly-raise": frontRaise([{ k: "pad", at: "elb" }], { fe: undefined, fh: 0, at: ["hip", 60, 49] }),
  "db-lateral-raise": frontRaise(DB),
  "cable-lateral-raise": frontRaise(cable(70, 94)),

  // Arms
  "triceps-pushdown": { load: cable(76, 2), a: { ...standing, ua: -4, fa: 150 }, b: { ...standing, ua: -4, fa: 4 } },
  "overhead-triceps-extension": { load: DB, a: { ...standing, ua: 172, fa: 338 }, b: { ...standing, ua: 172, fa: 180 } },
  "overhead-cable-triceps": {
    load: cable(8, 70),
    a: { t: 150, th: 16, sh: -6, th2: -18, sh2: 0, ua: 150, fa: 300, at: ["ank", 66, 92] },
    b: { t: 150, th: 16, sh: -6, th2: -18, sh2: 0, ua: 150, fa: 150, at: ["ank", 66, 92] },
  },
  "skull-crusher": lyingPress(BB, { a: { ua: 166, fa: 300 }, b: { ua: 166, fa: 172 } }),
  "barbell-curl": curl(BB),
  "hammer-curl": curl(DB),
  "incline-db-curl": {
    eq: [benchBack, ...seatLegs(78, 75)], load: DB,
    a: { t: 220, th: 85, sh: 8, ua: -6, fa: -6, at: ["hip", 74, 69] },
    b: { t: 220, th: 85, sh: 8, ua: -6, fa: 150, at: ["hip", 74, 69] },
  },
  "preacher-curl": {
    eq: [{ seg: ["sho", "elb"], off: -4, ext: [-2, 6] }, ...seatLegs(46, 76), { l: [70, 70, 70, 96], w: 3 }], load: BB,
    a: { t: 168, th: 90, sh: 0, ua: 48, fa: 66, at: ["hip", 46, 71] },
    b: { t: 168, th: 90, sh: 0, ua: 48, fa: 176, at: ["hip", 46, 71] },
  },
  "bayesian-curl": {
    load: cable(10, 90),
    a: { t: 176, th: 14, sh: -6, th2: -14, sh2: 0, ua: -28, fa: -24, at: ["ank", 66, 92] },
    b: { t: 176, th: 14, sh: -6, th2: -14, sh2: 0, ua: -28, fa: 136, at: ["ank", 66, 92] },
  },

  // Core
  "cable-crunch": {
    load: cable(66, 2),
    a: { t: 172, th: 0, sh: -90, ft: 0, ua: 168, fa: 330, hd: 168, at: ["knee", 52, 92] },
    b: { t: 96, th: 0, sh: -90, ft: 0, ua: 70, fa: 240, hd: 80, at: ["knee", 52, 92] },
  },
  "hanging-leg-raise": {
    floor: false, eq: [{ l: [44, 8, 84, 8], w: 4 }],
    a: { t: 180, ua: 180, fa: 180, th: 2, sh: -4, at: ["hand", 60, 8] },
    b: { t: 186, ua: 180, fa: 180, th: 96, sh: 92, at: ["hand", 60, 8] },
  },
  "ab-wheel": {
    load: [{ k: "plate", at: "hand" }],
    a: { t: 128, th: 22, sh: -90, ft: 0, ua: 4, fa: 4, at: ["knee", 40, 92] },
    b: { t: 96, th: 70, sh: -90, ft: 0, ua: 100, fa: 100, at: ["knee", 40, 92] },
  },
  crunch: {
    a: { t: 270, th: 140, sh: 16, ua: 150, fa: 300, hd: 270, at: ["hip", 62, 90] },
    b: { t: 238, th: 140, sh: 16, ua: 120, fa: 270, hd: 230, at: ["hip", 62, 90] },
  },
};
delete POSES["walking-lunge-db"];
