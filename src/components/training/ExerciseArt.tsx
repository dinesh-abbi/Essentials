import { memo } from 'react';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

import { Colors, Hue, mix } from '@/constants/theme';
import { DEFAULT_SCENE, POSES, SCENES, type Point, type Pose, type Prop } from '@/data/training/poses';

/**
 * The illustrated scene for one library exercise: a posed figure, its
 * equipment, and a coral arrow for the direction of the working rep. Ported
 * from Forma's web ExerciseArt; joints and props live in data/training/poses.ts.
 */

const C = Colors.dark;
const FIGURE = mix('#FFFFFF', C.surface2, 0.62);
const FIGURE_FAR = mix('#FFFFFF', C.surface2, 0.42);
const FIGURE_EDGE = C.bg;
const HARD = C.hairline;
const PAD = mix('#FFFFFF', C.surface2, 0.18);
const STEEL = C.textMid;
const ARROW = Hue.train.main;

/** Shoulder, waist and pelvis half-widths used to inflate the spine into a torso. */
const TORSO = [26, 19, 23];
const p = (pt: Point) => `${pt[0]} ${pt[1]}`;

function normals(line: Point[]): Point[] {
  return line.map((_, i) => {
    const a = line[Math.max(0, i - 1)];
    const b = line[Math.min(line.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    return [-dy / len, dx / len];
  });
}

function torsoPath(spine: Point[]) {
  const n = normals(spine);
  const side = (sign: number): Point[] =>
    spine.map((pt, i) => [pt[0] + n[i][0] * sign * (TORSO[i] / 2), pt[1] + n[i][1] * sign * (TORSO[i] / 2)]);
  const [l0, l1, l2] = side(1);
  const [r0, r1, r2] = side(-1);
  return `M${p(l0)} Q${p(l1)} ${p(l2)} L${p(r2)} Q${p(r1)} ${p(r0)} Z`;
}

const limbPath = (limb: Point[]) => `M${limb.map(p).join(' L')}`;

/** Control point of a quadratic bowed perpendicular to the from→to line. */
function bowControl(from: Point, to: Point, bend: number): Point {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  return [(from[0] + to[0]) / 2 - (dy / len) * bend, (from[1] + to[1]) / 2 + (dx / len) * bend];
}

const bowPath = (from: Point, to: Point, bend = 10) => `M${p(from)} Q${p(bowControl(from, to, bend))} ${p(to)}`;

/** Arrowhead at `to`, along the curve's end tangent (react-native-svg has no reliable markers). */
function arrowTip(from: Point, to: Point, bend = 10) {
  const c = bowControl(from, to, bend);
  const angle = (Math.atan2(to[1] - c[1], to[0] - c[0]) * 180) / Math.PI;
  return <Path d="M-4 -4.5 L5 0 L-4 4.5 Z" fill={ARROW} transform={`translate(${to[0]}, ${to[1]}) rotate(${angle})`} />;
}

/** Each limb is stroked twice, edge first, so crossing limbs keep an outline. */
function Limbs({ limbs, far = false }: { limbs: Point[][]; far?: boolean }) {
  return (
    <G fill="none" strokeLinecap="round" strokeLinejoin="round">
      {limbs.map((limb, i) => {
        const d = limbPath(limb);
        return (
          <G key={i}>
            <Path d={d} stroke={FIGURE_EDGE} strokeWidth={13} />
            <Path d={d} stroke={far ? FIGURE_FAR : FIGURE} strokeWidth={10} />
          </G>
        );
      })}
    </G>
  );
}

function Figure({ pose }: { pose: Pose }) {
  const split = pose.depth ? 1 : 0;
  const neck: Point[] = [pose.head, pose.spine[0]];
  return (
    <G>
      <Limbs limbs={[...pose.arms.slice(0, split), ...pose.legs.slice(0, split)]} far />
      <Limbs limbs={[neck]} />
      <Path d={torsoPath(pose.spine)} fill={FIGURE} stroke={FIGURE_EDGE} strokeWidth={1.6} />
      <Circle cx={pose.head[0]} cy={pose.head[1]} r={pose.headR} fill={FIGURE} stroke={FIGURE_EDGE} strokeWidth={1.6} />
      <Limbs limbs={[...pose.arms.slice(split), ...pose.legs.slice(split)]} />
    </G>
  );
}

function Equipment({ item }: { item: Prop }) {
  switch (item.kind) {
    case 'floor':
      return <Line x1={14} y1={item.y ?? 174} x2={186} y2={item.y ?? 174} stroke={HARD} strokeWidth={2} strokeLinecap="round" />;
    case 'mat':
      return <Rect x={12} y={(item.y ?? 168) - 4} width={176} height={8} rx={4} fill={HARD} />;
    case 'bench':
      return (
        <G fill={HARD} transform={item.tilt ? `rotate(${item.tilt}, ${item.x + item.w / 2}, ${item.y})` : undefined}>
          <Rect x={item.x} y={item.y} width={item.w} height={9} rx={4} />
          <Rect x={item.x + 6} y={item.y + 9} width={6} height={28} rx={3} />
          <Rect x={item.x + item.w - 12} y={item.y + 9} width={6} height={28} rx={3} />
        </G>
      );
    case 'seat': {
      const w = item.w ?? 36;
      return (
        <G fill={HARD}>
          <Rect x={item.x} y={item.y} width={w} height={8} rx={4} />
          <Rect x={item.x + w / 2 - 3} y={item.y + 8} width={6} height={24} rx={3} />
          <Rect x={item.x + w / 2 - 12} y={item.y + 32} width={24} height={5} rx={2} />
        </G>
      );
    }
    case 'frame':
      return (
        <G stroke={HARD} strokeWidth={3} strokeLinecap="round">
          <Rect x={item.x} y={item.y} width={item.w} height={item.h} rx={6} fill="none" />
          <Line x1={item.x} y1={item.y + 12} x2={item.x + item.w} y2={item.y + 12} />
        </G>
      );
    case 'stack':
      return (
        <G>
          <Rect x={item.x - 12} y={item.y - 8} width={24} height={46} rx={4} fill={HARD} />
          <G stroke={STEEL} strokeWidth={1.6} opacity={0.6}>
            {[4, 12, 20].map((dy) => (
              <Line key={dy} x1={item.x - 8} y1={item.y + dy} x2={item.x + 8} y2={item.y + dy} />
            ))}
          </G>
        </G>
      );
    case 'step':
      return <Rect x={item.x} y={item.y} width={item.w} height={12} rx={3} fill={HARD} />;
    case 'pad':
      return <Rect x={item.at[0] - 9} y={item.at[1] - 6} width={18} height={12} rx={6} fill={PAD} />;
    case 'bar': {
      const len = item.len ?? 40;
      const [x, y] = item.at;
      return (
        <G transform={`rotate(${item.angle ?? 0}, ${x}, ${y})`}>
          <Line x1={x - len / 2} y1={y} x2={x + len / 2} y2={y} stroke={STEEL} strokeWidth={4} strokeLinecap="round" />
          <Rect x={x - len / 2 - 3} y={y - 11} width={7} height={22} rx={3} fill={STEEL} />
          <Rect x={x + len / 2 - 4} y={y - 11} width={7} height={22} rx={3} fill={STEEL} />
        </G>
      );
    }
    case 'dumbbell': {
      const [x, y] = item.at;
      return (
        <G transform={`rotate(${item.angle ?? 0}, ${x}, ${y})`}>
          <Line x1={x - 7} y1={y} x2={x + 7} y2={y} stroke={STEEL} strokeWidth={4} strokeLinecap="round" />
          <Rect x={x - 11} y={y - 8} width={6} height={16} rx={2.5} fill={STEEL} />
          <Rect x={x + 5} y={y - 8} width={6} height={16} rx={2.5} fill={STEEL} />
        </G>
      );
    }
    case 'cable':
      return <Line x1={item.from[0]} y1={item.from[1]} x2={item.to[0]} y2={item.to[1]} stroke={STEEL} strokeWidth={2} strokeLinecap="round" />;
    case 'band':
      return (
        <Path
          d={bowPath(item.from, item.to, item.bend ?? 10)}
          fill="none"
          stroke={STEEL}
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeDasharray="9 5"
        />
      );
    case 'arc':
      return (
        <G>
          <Path
            d={bowPath(item.from, item.to, item.bend ?? 10)}
            fill="none"
            stroke={ARROW}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeDasharray="6 5"
          />
          {arrowTip(item.from, item.to, item.bend ?? 10)}
        </G>
      );
  }
}

export const ExerciseArt = memo(function ExerciseArt({
  exerciseId,
  name,
  width,
}: {
  exerciseId: string;
  name?: string;
  width: number;
}) {
  const scene = SCENES[exerciseId] ?? DEFAULT_SCENE;
  const pose = POSES[scene.pose];
  const behind = scene.props.filter((item) => item.kind !== 'arc' && item.kind !== 'bar' && item.kind !== 'dumbbell');
  const front = scene.props.filter((item) => item.kind === 'bar' || item.kind === 'dumbbell');
  const arcs = scene.props.filter((item) => item.kind === 'arc');
  return (
    <Svg
      width={width}
      height={(width * 186) / 200}
      viewBox="0 0 200 186"
      accessibilityRole="image"
      accessibilityLabel={name ? `Illustration of ${name}` : 'Exercise illustration'}
    >
      {behind.map((item, i) => (
        <Equipment key={`b${i}`} item={item} />
      ))}
      <Figure pose={pose} />
      {front.map((item, i) => (
        <Equipment key={`f${i}`} item={item} />
      ))}
      {arcs.map((item, i) => (
        <Equipment key={`c${i}`} item={item} />
      ))}
    </Svg>
  );
});
