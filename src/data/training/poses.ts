/** Illustration data for the exercise library (ported from Forma).
 *  Every figure is drawn in a 200x200 stage with the floor at y=174.
 *  A pose is a set of joints; a scene is a pose plus the equipment around it,
 *  so 34 exercises reuse ~20 poses instead of 34 hand-drawn pictures. */
export type Point = [number, number];
export type Pose = {
  head: Point;
  headR: number;
  /** Neck, waist, and pelvis. The torso is built by offsetting this line. */
  spine: [Point, Point, Point];
  /** Each limb is [shoulder|hip, elbow|knee, hand|foot]. */
  arms: Point[][];
  legs: Point[][];
  /** Side views shade the first limb of each pair as the far side of the body. */
  depth?: boolean;
};

const pose = (p: Pose) => p;

/** Front-view standing poses share a head, torso, and legs; only the arms
 *  differ. Knees and feet sit outside the pelvis so the legs stay readable
 *  against the torso. `hip` is the pelvis height; shoulders land at hip - 46. */
const standing = (hip: number, arms: Point[][], feet = 174): Pose => ({
  head: [100, hip - 66],
  headR: 12,
  spine: [
    [100, hip - 52],
    [100, hip - 26],
    [100, hip],
  ],
  arms,
  legs: [
    [
      [91, hip],
      [86, (hip + feet) / 2],
      [85, feet],
    ],
    [
      [109, hip],
      [114, (hip + feet) / 2],
      [115, feet],
    ],
  ],
});

export const POSES = {
  stand: standing(102, [
    [
      [85, 56],
      [76, 84],
      [74, 112],
    ],
    [
      [115, 56],
      [124, 84],
      [126, 112],
    ],
  ]),
  press: standing(104, [
    [
      [85, 58],
      [70, 44],
      [80, 18],
    ],
    [
      [115, 58],
      [130, 44],
      [120, 18],
    ],
  ]),
  raise: standing(103, [
    [
      [85, 57],
      [61, 53],
      [37, 57],
    ],
    [
      [115, 57],
      [139, 53],
      [163, 57],
    ],
  ]),
  curl: standing(102, [
    [
      [85, 56],
      [80, 86],
      [92, 62],
    ],
    [
      [115, 56],
      [120, 86],
      [108, 62],
    ],
  ]),
  pushdown: standing(103, [
    [
      [85, 57],
      [82, 84],
      [90, 106],
    ],
    [
      [115, 57],
      [118, 84],
      [110, 106],
    ],
  ]),
  overhead: standing(106, [
    [
      [85, 60],
      [86, 26],
      [104, 56],
    ],
    [
      [115, 60],
      [114, 26],
      [96, 56],
    ],
  ]),
  kneel: standing(
    128,
    [
      [
        [85, 82],
        [77, 58],
        [84, 36],
      ],
      [
        [115, 82],
        [123, 58],
        [116, 36],
      ],
    ],
    172,
  ),
  carry: standing(100, [
    [
      [85, 54],
      [77, 84],
      [75, 116],
    ],
    [
      [115, 54],
      [123, 84],
      [125, 116],
    ],
  ]),
  apart: standing(103, [
    [
      [85, 57],
      [63, 63],
      [41, 59],
    ],
    [
      [115, 57],
      [137, 63],
      [159, 59],
    ],
  ]),
  pulldownStanding: standing(118, [
    [
      [85, 72],
      [77, 48],
      [84, 26],
    ],
    [
      [115, 72],
      [123, 48],
      [116, 26],
    ],
  ]),
  toeRaise: standing(
    98,
    [
      [
        [85, 52],
        [76, 80],
        [74, 108],
      ],
      [
        [115, 52],
        [124, 80],
        [126, 108],
      ],
    ],
    162,
  ),
  /** Lying on one side, knees bent, top knee lifting away from the bottom. */
  sideLying: pose({
    head: [46, 122],
    headR: 10,
    depth: true,
    spine: [
      [62, 126],
      [92, 130],
      [122, 134],
    ],
    arms: [
      [
        [66, 128],
        [54, 116],
        [42, 108],
      ],
      [
        [68, 132],
        [88, 140],
        [108, 146],
      ],
    ],
    legs: [
      [
        [122, 136],
        [150, 146],
        [142, 166],
      ],
      [
        [122, 130],
        [152, 120],
        [140, 142],
      ],
    ],
  }),
  squat: pose({
    head: [100, 50],
    headR: 12,
    spine: [
      [100, 64],
      [100, 88],
      [100, 110],
    ],
    arms: [
      [
        [86, 70],
        [74, 92],
        [92, 84],
      ],
      [
        [114, 70],
        [126, 92],
        [108, 84],
      ],
    ],
    legs: [
      [
        [92, 110],
        [66, 138],
        [78, 174],
      ],
      [
        [108, 110],
        [134, 138],
        [122, 174],
      ],
    ],
  }),
  lunge: pose({
    head: [92, 42],
    headR: 11,
    depth: true,
    spine: [
      [94, 56],
      [98, 82],
      [102, 108],
    ],
    arms: [
      [
        [92, 62],
        [86, 88],
        [84, 114],
      ],
      [
        [98, 62],
        [104, 88],
        [106, 114],
      ],
    ],
    legs: [
      [
        [102, 108],
        [76, 140],
        [58, 168],
      ],
      [
        [102, 108],
        [132, 136],
        [132, 174],
      ],
    ],
  }),
  hinge: pose({
    head: [58, 76],
    headR: 11,
    depth: true,
    spine: [
      [72, 82],
      [98, 94],
      [122, 104],
    ],
    arms: [
      [
        [78, 88],
        [78, 114],
        [78, 140],
      ],
      [
        [74, 84],
        [72, 110],
        [72, 136],
      ],
    ],
    legs: [
      [
        [124, 106],
        [130, 140],
        [126, 174],
      ],
      [
        [120, 104],
        [124, 140],
        [120, 174],
      ],
    ],
  }),
  row: pose({
    head: [58, 76],
    headR: 11,
    depth: true,
    spine: [
      [72, 82],
      [98, 94],
      [122, 104],
    ],
    arms: [
      [
        [78, 88],
        [78, 114],
        [78, 140],
      ],
      [
        [74, 84],
        [96, 100],
        [78, 108],
      ],
    ],
    legs: [
      [
        [124, 106],
        [130, 140],
        [126, 174],
      ],
      [
        [120, 104],
        [124, 140],
        [120, 174],
      ],
    ],
  }),
  rearFly: pose({
    head: [58, 76],
    headR: 11,
    depth: true,
    spine: [
      [72, 82],
      [98, 94],
      [122, 104],
    ],
    arms: [
      [
        [78, 88],
        [96, 108],
        [116, 124],
      ],
      [
        [74, 84],
        [56, 104],
        [36, 120],
      ],
    ],
    legs: [
      [
        [124, 106],
        [130, 140],
        [126, 174],
      ],
      [
        [120, 104],
        [124, 140],
        [120, 174],
      ],
    ],
  }),
  bench: pose({
    head: [52, 100],
    headR: 11,
    depth: true,
    spine: [
      [66, 104],
      [94, 107],
      [122, 110],
    ],
    arms: [
      [
        [70, 100],
        [66, 78],
        [70, 54],
      ],
      [
        [74, 104],
        [72, 80],
        [76, 56],
      ],
    ],
    legs: [
      [
        [122, 112],
        [146, 136],
        [144, 174],
      ],
      [
        [124, 108],
        [150, 134],
        [150, 174],
      ],
    ],
  }),
  floorPress: pose({
    head: [52, 140],
    headR: 11,
    depth: true,
    spine: [
      [66, 143],
      [94, 145],
      [120, 147],
    ],
    arms: [
      [
        [70, 139],
        [66, 120],
        [70, 100],
      ],
      [
        [74, 143],
        [72, 122],
        [76, 102],
      ],
    ],
    legs: [
      [
        [120, 149],
        [142, 126],
        [144, 168],
      ],
      [
        [122, 145],
        [148, 124],
        [152, 168],
      ],
    ],
  }),
  plank: pose({
    head: [50, 98],
    headR: 10,
    depth: true,
    spine: [
      [64, 102],
      [100, 113],
      [136, 124],
    ],
    arms: [
      [
        [66, 100],
        [64, 128],
        [62, 156],
      ],
      [
        [70, 104],
        [68, 130],
        [66, 158],
      ],
    ],
    legs: [
      [
        [136, 126],
        [158, 140],
        [180, 156],
      ],
      [
        [138, 122],
        [160, 136],
        [182, 152],
      ],
    ],
  }),
  bridge: pose({
    head: [44, 138],
    headR: 10,
    depth: true,
    spine: [
      [58, 136],
      [88, 123],
      [116, 119],
    ],
    arms: [
      [
        [60, 138],
        [64, 156],
        [80, 164],
      ],
      [
        [62, 134],
        [66, 152],
        [82, 160],
      ],
    ],
    legs: [
      [
        [116, 121],
        [142, 144],
        [140, 174],
      ],
      [
        [118, 117],
        [146, 140],
        [146, 174],
      ],
    ],
  }),
  deadbug: pose({
    head: [54, 144],
    headR: 10,
    depth: true,
    spine: [
      [68, 144],
      [98, 144],
      [128, 144],
    ],
    arms: [
      [
        [72, 146],
        [88, 156],
        [104, 162],
      ],
      [
        [70, 142],
        [68, 118],
        [66, 94],
      ],
    ],
    legs: [
      [
        [128, 146],
        [152, 152],
        [176, 152],
      ],
      [
        [128, 142],
        [130, 118],
        [152, 108],
      ],
    ],
  }),
  quadruped: pose({
    head: [48, 116],
    headR: 11,
    depth: true,
    spine: [
      [62, 100],
      [98, 100],
      [134, 100],
    ],
    arms: [
      [
        [64, 102],
        [62, 128],
        [60, 154],
      ],
      [
        [62, 96],
        [40, 92],
        [18, 90],
      ],
    ],
    legs: [
      [
        [134, 102],
        [136, 128],
        [138, 154],
      ],
      [
        [134, 96],
        [156, 92],
        [178, 90],
      ],
    ],
  }),
  seatedPull: pose({
    head: [74, 56],
    headR: 11,
    depth: true,
    spine: [
      [86, 66],
      [92, 94],
      [96, 120],
    ],
    arms: [
      [
        [88, 76],
        [110, 86],
        [134, 90],
      ],
      [
        [86, 72],
        [108, 82],
        [132, 86],
      ],
    ],
    legs: [
      [
        [98, 124],
        [130, 130],
        [156, 124],
      ],
      [
        [96, 120],
        [128, 126],
        [154, 120],
      ],
    ],
  }),
  seatedPulldown: pose({
    head: [74, 74],
    headR: 11,
    depth: true,
    spine: [
      [86, 84],
      [92, 110],
      [96, 134],
    ],
    arms: [
      [
        [88, 90],
        [82, 62],
        [80, 38],
      ],
      [
        [86, 86],
        [78, 58],
        [76, 34],
      ],
    ],
    legs: [
      [
        [98, 138],
        [126, 146],
        [126, 172],
      ],
      [
        [96, 134],
        [124, 142],
        [124, 168],
      ],
    ],
  }),
  legExtend: pose({
    head: [66, 52],
    headR: 11,
    depth: true,
    spine: [
      [78, 62],
      [84, 90],
      [90, 116],
    ],
    arms: [
      [
        [80, 72],
        [84, 94],
        [98, 108],
      ],
      [
        [78, 68],
        [82, 90],
        [96, 104],
      ],
    ],
    legs: [
      [
        [92, 120],
        [126, 126],
        [154, 114],
      ],
      [
        [90, 116],
        [124, 122],
        [152, 110],
      ],
    ],
  }),
  legCurl: pose({
    head: [66, 52],
    headR: 11,
    depth: true,
    spine: [
      [78, 62],
      [84, 90],
      [90, 116],
    ],
    arms: [
      [
        [80, 72],
        [84, 94],
        [98, 108],
      ],
      [
        [78, 68],
        [82, 90],
        [96, 104],
      ],
    ],
    legs: [
      [
        [92, 120],
        [126, 124],
        [132, 156],
      ],
      [
        [90, 116],
        [124, 120],
        [130, 152],
      ],
    ],
  }),
  seatedLap: pose({
    head: [66, 54],
    headR: 11,
    depth: true,
    spine: [
      [78, 64],
      [84, 92],
      [90, 118],
    ],
    arms: [
      [
        [80, 74],
        [96, 98],
        [122, 112],
      ],
      [
        [78, 70],
        [94, 94],
        [120, 108],
      ],
    ],
    legs: [
      [
        [92, 122],
        [124, 128],
        [124, 168],
      ],
      [
        [90, 118],
        [122, 124],
        [122, 164],
      ],
    ],
  }),
  pallof: pose({
    head: [88, 40],
    headR: 11,
    depth: true,
    spine: [
      [90, 54],
      [92, 80],
      [94, 106],
    ],
    arms: [
      [
        [92, 62],
        [116, 68],
        [140, 72],
      ],
      [
        [90, 58],
        [114, 64],
        [138, 68],
      ],
    ],
    legs: [
      [
        [88, 106],
        [78, 140],
        [76, 174],
      ],
      [
        [100, 106],
        [108, 140],
        [110, 174],
      ],
    ],
  }),
} satisfies Record<string, Pose>;

export type PoseName = keyof typeof POSES;

export type Prop =
  | { kind: 'floor'; y?: number }
  | { kind: 'mat'; y?: number }
  | { kind: 'bench'; x: number; y: number; w: number; tilt?: number }
  | { kind: 'seat'; x: number; y: number; w?: number }
  | { kind: 'frame'; x: number; y: number; w: number; h: number }
  | { kind: 'stack'; x: number; y: number }
  | { kind: 'step'; x: number; y: number; w: number }
  | { kind: 'bar'; at: Point; len?: number; angle?: number }
  | { kind: 'dumbbell'; at: Point; angle?: number }
  | { kind: 'cable'; from: Point; to: Point }
  | { kind: 'band'; from: Point; to: Point; bend?: number }
  | { kind: 'pad'; at: Point }
  | { kind: 'arc'; from: Point; to: Point; bend?: number };

export type Scene = { pose: PoseName; props: Prop[] };

/** One scene per catalog exercise. Ids match data/training/exercises.json. */
export const SCENES: Record<string, Scene> = {
  bench: {
    pose: 'bench',
    props: [
      { kind: 'floor' },
      { kind: 'bench', x: 58, y: 116, w: 78 },
      { kind: 'bar', at: [73, 52], len: 42 },
      { kind: 'arc', from: [110, 50], to: [110, 88], bend: 14 },
    ],
  },
  incline: {
    pose: 'bench',
    props: [
      { kind: 'floor' },
      { kind: 'bench', x: 58, y: 116, w: 78, tilt: -16 },
      { kind: 'dumbbell', at: [70, 54], angle: 96 },
      { kind: 'dumbbell', at: [76, 56], angle: 96 },
      { kind: 'arc', from: [110, 48], to: [110, 86], bend: 14 },
    ],
  },
  shoulder: {
    pose: 'press',
    props: [
      { kind: 'floor' },
      { kind: 'seat', x: 84, y: 108, w: 32 },
      { kind: 'dumbbell', at: [80, 18] },
      { kind: 'dumbbell', at: [120, 18] },
      { kind: 'arc', from: [150, 54], to: [150, 20], bend: 10 },
    ],
  },
  lateral: {
    pose: 'raise',
    props: [
      { kind: 'floor' },
      { kind: 'dumbbell', at: [37, 57] },
      { kind: 'dumbbell', at: [163, 57] },
      { kind: 'arc', from: [172, 100], to: [176, 58], bend: 16 },
    ],
  },
  triceps: {
    pose: 'pushdown',
    props: [
      { kind: 'floor' },
      { kind: 'stack', x: 26, y: 24 },
      { kind: 'cable', from: [42, 30], to: [100, 106] },
      { kind: 'bar', at: [100, 106], len: 26 },
      { kind: 'arc', from: [142, 72], to: [142, 108], bend: 8 },
    ],
  },
  squat: {
    pose: 'squat',
    props: [
      { kind: 'floor' },
      { kind: 'dumbbell', at: [100, 84] },
      { kind: 'arc', from: [158, 90], to: [158, 126], bend: 10 },
    ],
  },
  row: {
    pose: 'seatedPull',
    props: [
      { kind: 'floor' },
      { kind: 'seat', x: 80, y: 126, w: 40 },
      { kind: 'step', x: 150, y: 126, w: 26 },
      { kind: 'frame', x: 172, y: 100, w: 18, h: 62 },
      { kind: 'cable', from: [176, 108], to: [134, 90] },
      { kind: 'bar', at: [134, 88], len: 16 },
      { kind: 'arc', from: [124, 56], to: [92, 56], bend: 10 },
    ],
  },
  pulldown: {
    pose: 'seatedPulldown',
    props: [
      { kind: 'floor' },
      { kind: 'seat', x: 84, y: 140, w: 44 },
      { kind: 'stack', x: 30, y: 30 },
      { kind: 'cable', from: [42, 34], to: [78, 32] },
      { kind: 'bar', at: [86, 30], len: 48 },
      { kind: 'arc', from: [142, 44], to: [142, 82], bend: 10 },
    ],
  },
  curl: {
    pose: 'curl',
    props: [
      { kind: 'floor' },
      { kind: 'dumbbell', at: [92, 62], angle: 90 },
      { kind: 'dumbbell', at: [108, 62], angle: 90 },
      { kind: 'arc', from: [152, 100], to: [152, 64], bend: 12 },
    ],
  },
  deadbug: {
    pose: 'deadbug',
    props: [
      { kind: 'mat' },
      { kind: 'arc', from: [30, 118], to: [30, 150], bend: 8 },
    ],
  },
  rdl: {
    pose: 'hinge',
    props: [
      { kind: 'floor' },
      { kind: 'dumbbell', at: [78, 140], angle: 90 },
      { kind: 'dumbbell', at: [72, 136], angle: 90 },
      { kind: 'arc', from: [162, 92], to: [162, 130], bend: 12 },
    ],
  },
  bridge: {
    pose: 'bridge',
    props: [
      { kind: 'mat' },
      { kind: 'arc', from: [92, 152], to: [92, 112], bend: 10 },
    ],
  },
  pushup: {
    pose: 'plank',
    props: [
      { kind: 'mat' },
      { kind: 'arc', from: [104, 88], to: [104, 126], bend: 10 },
    ],
  },
  'floor-press': {
    pose: 'floorPress',
    props: [
      { kind: 'mat' },
      { kind: 'dumbbell', at: [70, 100], angle: 96 },
      { kind: 'dumbbell', at: [76, 102], angle: 96 },
      { kind: 'arc', from: [100, 90], to: [100, 126], bend: 10 },
    ],
  },
  'rear-fly': {
    pose: 'rearFly',
    props: [
      { kind: 'floor' },
      { kind: 'dumbbell', at: [36, 120], angle: 20 },
      { kind: 'dumbbell', at: [116, 124], angle: -20 },
      { kind: 'arc', from: [150, 152], to: [124, 128], bend: 10 },
    ],
  },
  'hammer-curl': {
    pose: 'curl',
    props: [
      { kind: 'floor' },
      { kind: 'dumbbell', at: [92, 62] },
      { kind: 'dumbbell', at: [108, 62] },
      { kind: 'arc', from: [152, 100], to: [152, 64], bend: 12 },
    ],
  },
  'overhead-triceps': {
    pose: 'overhead',
    props: [
      { kind: 'floor' },
      { kind: 'dumbbell', at: [100, 48] },
      { kind: 'arc', from: [150, 50], to: [150, 20], bend: 10 },
    ],
  },
  'close-pushup': {
    pose: 'plank',
    props: [
      { kind: 'mat' },
      { kind: 'arc', from: [104, 88], to: [104, 126], bend: 10 },
    ],
  },
  'farmer-carry': {
    pose: 'carry',
    props: [
      { kind: 'floor' },
      { kind: 'dumbbell', at: [75, 116], angle: 90 },
      { kind: 'dumbbell', at: [125, 116], angle: 90 },
      { kind: 'arc', from: [34, 152], to: [68, 152], bend: 0 },
    ],
  },
  'wrist-curl': {
    pose: 'seatedLap',
    props: [
      { kind: 'floor' },
      { kind: 'seat', x: 78, y: 124, w: 40 },
      { kind: 'dumbbell', at: [122, 112], angle: 90 },
      { kind: 'arc', from: [154, 126], to: [154, 102], bend: 8 },
    ],
  },
  'bird-dog': {
    pose: 'quadruped',
    props: [
      { kind: 'mat' },
      { kind: 'arc', from: [18, 74], to: [180, 74], bend: 10 },
    ],
  },
  pallof: {
    pose: 'pallof',
    props: [
      { kind: 'floor' },
      { kind: 'stack', x: 180, y: 52 },
      { kind: 'cable', from: [174, 58], to: [140, 70] },
      { kind: 'arc', from: [56, 58], to: [56, 94], bend: 10 },
    ],
  },
  'side-knee': {
    pose: 'sideLying',
    props: [
      { kind: 'mat', y: 170 },
      { kind: 'arc', from: [166, 142], to: [166, 112], bend: 9 },
    ],
  },
  'split-squat': {
    pose: 'lunge',
    props: [
      { kind: 'floor' },
      { kind: 'dumbbell', at: [84, 114], angle: 90 },
      { kind: 'dumbbell', at: [106, 114], angle: 90 },
      { kind: 'arc', from: [166, 96], to: [166, 130], bend: 10 },
    ],
  },
  'leg-extension': {
    pose: 'legExtend',
    props: [
      { kind: 'floor' },
      { kind: 'frame', x: 62, y: 118, w: 68, h: 56 },
      { kind: 'pad', at: [152, 112] },
      { kind: 'arc', from: [168, 146], to: [168, 110], bend: 10 },
    ],
  },
  'calf-raise': {
    pose: 'toeRaise',
    props: [
      { kind: 'floor' },
      { kind: 'step', x: 76, y: 162, w: 48 },
      { kind: 'arc', from: [148, 142], to: [148, 104], bend: 11 },
    ],
  },
  'seated-calf': {
    pose: 'seatedLap',
    props: [
      { kind: 'floor' },
      { kind: 'seat', x: 78, y: 124, w: 40 },
      { kind: 'step', x: 108, y: 166, w: 34 },
      { kind: 'pad', at: [122, 112] },
      { kind: 'arc', from: [158, 160], to: [158, 136], bend: 8 },
    ],
  },
  'one-arm-row': {
    pose: 'row',
    props: [
      { kind: 'floor' },
      { kind: 'bench', x: 52, y: 144, w: 54 },
      { kind: 'dumbbell', at: [78, 108], angle: 90 },
      { kind: 'arc', from: [34, 128], to: [34, 94], bend: 10 },
    ],
  },
  'band-pull': {
    pose: 'apart',
    props: [
      { kind: 'floor' },
      { kind: 'band', from: [41, 59], to: [159, 59], bend: 12 },
      { kind: 'arc', from: [28, 96], to: [54, 78], bend: 8 },
    ],
  },
  'band-pulldown': {
    pose: 'kneel',
    props: [
      { kind: 'floor', y: 172 },
      { kind: 'step', x: 86, y: 14, w: 28 },
      { kind: 'band', from: [84, 36], to: [98, 26], bend: 5 },
      { kind: 'band', from: [116, 36], to: [102, 26], bend: -5 },
      { kind: 'arc', from: [152, 42], to: [152, 80], bend: 10 },
    ],
  },
  'hip-hinge': {
    pose: 'hinge',
    props: [
      { kind: 'floor' },
      { kind: 'arc', from: [162, 92], to: [162, 130], bend: 12 },
    ],
  },
  'hip-thrust': {
    pose: 'bridge',
    props: [
      { kind: 'floor' },
      { kind: 'bench', x: 34, y: 150, w: 46 },
      { kind: 'bar', at: [102, 120], len: 30 },
      { kind: 'arc', from: [102, 156], to: [102, 112], bend: 10 },
    ],
  },
  'leg-curl': {
    pose: 'legCurl',
    props: [
      { kind: 'floor' },
      { kind: 'frame', x: 62, y: 118, w: 68, h: 56 },
      { kind: 'pad', at: [132, 156] },
      { kind: 'arc', from: [168, 110], to: [168, 148], bend: 10 },
    ],
  },
  'heel-bridge': {
    pose: 'bridge',
    props: [
      { kind: 'mat' },
      { kind: 'arc', from: [92, 152], to: [92, 112], bend: 10 },
    ],
  },
};

/** Fallback so a new catalog entry still renders something sensible. */
export const DEFAULT_SCENE: Scene = {
  pose: 'stand',
  props: [{ kind: 'floor' }],
};
