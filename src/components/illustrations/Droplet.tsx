import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';

import { Colors, Hue, mix, Motion } from '@/constants/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

const VB_W = 100;
const VB_H = 124;
const BOTTOM = 120;
const TOP = 4;
const DROP = 'M50 4 C50 4 10 52 10 80 A40 40 0 0 0 90 80 C90 52 50 4 50 4 Z';
const SAMPLES = 16;

const INK = Colors.dark.onAccent;

type Mood = 'thirsty' | 'ok' | 'happy' | 'joy';

const moodFor = (ratio: number): Mood => (ratio >= 1 ? 'joy' : ratio >= 0.6 ? 'happy' : ratio >= 0.25 ? 'ok' : 'thirsty');

const MOUTH: Record<Mood, { d: string; filled: boolean }> = {
  thirsty: { d: 'M41 97 Q50 89 59 97', filled: false },
  ok: { d: 'M41 91 Q50 98 59 91', filled: false },
  happy: { d: 'M37 89 Q50 103 63 89', filled: false },
  joy: { d: 'M36 88 Q50 110 64 88 Z', filled: true },
};

/**
 * "Drip" — the hydration mascot. The drop fills with water as the day's
 * intake rises, and its face follows: thirsty → okay → happy → overjoyed at
 * the goal. It blinks now and then, and every logged glass makes a drop fall
 * in and the body squash-and-stretch. The whole point is that you can read
 * how you're doing from across the room without reading a number.
 */
export default function Droplet({
  ratio,
  size = 120,
  bumpTick = 0,
}: {
  ratio: number;
  size?: number;
  /** Increment to play the "glass poured in" reaction. 0 = never played. */
  bumpTick?: number;
}) {
  const reduceMotion = useReducedMotion();
  const water = Hue.water;
  const bodyEmpty = mix(water.main, Colors.dark.bg, 0.2);
  const target = Math.min(1, Math.max(0, ratio));
  const mood = moodFor(ratio);

  const level = useSharedValue(0);
  const phase = useSharedValue(0);
  const blink = useSharedValue(1);
  const squash = useSharedValue(0);
  const fall = useSharedValue(0);
  const mounted = useRef(false);

  useEffect(() => {
    if (reduceMotion) {
      level.value = target;
    } else {
      level.value = mounted.current
        ? withSpring(target, { damping: 10, stiffness: 110, mass: 0.8 })
        : withTiming(target, { duration: Motion.duration.fill + 300, easing: Easing.out(Easing.cubic) });
    }
    mounted.current = true;
  }, [target, reduceMotion, level]);

  useEffect(() => {
    if (reduceMotion) return;
    phase.value = withRepeat(withTiming(Math.PI * 2, { duration: 2400, easing: Easing.linear }), -1, false);
    blink.value = withRepeat(
      withSequence(
        withDelay(3200, withTiming(0.1, { duration: 70 })),
        withTiming(1, { duration: 110 }),
        withDelay(160, withTiming(0.1, { duration: 70 })),
        withTiming(1, { duration: 110 }),
      ),
      -1,
      false,
    );
  }, [reduceMotion, phase, blink]);

  useEffect(() => {
    if (bumpTick === 0 || reduceMotion) return;
    fall.value = 0;
    fall.value = withTiming(1, { duration: 380, easing: Easing.in(Easing.quad) });
    squash.value = withDelay(
      300,
      withSequence(withTiming(1, { duration: 90 }), withSpring(0, { damping: 6, stiffness: 220, mass: 0.6 })),
    );
  }, [bumpTick, reduceMotion, fall, squash]);

  const waveProps = useAnimatedProps(() => {
    const y0 = BOTTOM - level.value * (BOTTOM - TOP);
    const amp = level.value > 0.97 ? 0 : 3;
    let d = '';
    for (let i = 0; i <= SAMPLES; i++) {
      const x = (VB_W / SAMPLES) * i;
      const y = y0 + Math.sin((i / SAMPLES) * Math.PI * 2 + phase.value) * amp;
      d += i === 0 ? `M ${x} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return { d: `${d} L ${VB_W} ${VB_H} L 0 ${VB_H} Z` } as any;
  });
  const eyeProps = useAnimatedProps(() => ({ ry: 8.5 * blink.value }) as any);
  const pupilProps = useAnimatedProps(() => ({ ry: 4.4 * blink.value }) as any);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1 + squash.value * 0.1 }, { scaleY: 1 - squash.value * 0.12 }],
  }));
  const fallStyle = useAnimatedStyle(() => ({
    opacity: fall.value === 0 || fall.value === 1 ? 0 : 1,
    transform: [{ translateY: -size * 0.35 + fall.value * size * 0.45 }],
  }));

  // The mouth/brows switch to white when the face is above the waterline.
  const faceUnderwater = BOTTOM - target * (BOTTOM - TOP) < 84;
  const line = faceUnderwater ? INK : '#FFFFFF';
  const mouth = MOUTH[mood];
  const h = (size * VB_H) / VB_W;

  return (
    <View style={{ width: size, height: h }} accessible={false} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.fall, { left: size / 2 - 9 }, fallStyle]} pointerEvents="none">
        <MaterialCommunityIcons name="water" size={18} color={water.main} />
      </Animated.View>
      <Animated.View style={[{ width: size, height: h, transformOrigin: 'bottom' }, bodyStyle]}>
        <Svg width={size} height={h} viewBox={`0 0 ${VB_W} ${VB_H}`}>
          <Defs>
            <ClipPath id="dripBody">
              <Path d={DROP} />
            </ClipPath>
            <LinearGradient id="dripFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={Colors.dark.waterStrong} />
              <Stop offset="1" stopColor={water.main} />
            </LinearGradient>
          </Defs>

          <G clipPath="url(#dripBody)">
            <Path d={DROP} fill={bodyEmpty} />
            <AnimatedPath animatedProps={waveProps} fill="url(#dripFill)" />
            {/* Glossy highlight */}
            <Ellipse cx={30} cy={56} rx={6} ry={13} fill="#FFFFFF" opacity={0.28} transform="rotate(25 30 56)" />
          </G>
          <Path d={DROP} fill="none" stroke={water.main} strokeWidth={3} strokeLinejoin="round" />

          {/* Brows only when thirsty — worried. */}
          {mood === 'thirsty' && (
            <G stroke={line} strokeWidth={3} strokeLinecap="round">
              <Path d="M28 64 L41 61" />
              <Path d="M72 64 L59 61" />
            </G>
          )}

          {/* Eyes */}
          <AnimatedEllipse cx={37} cy={76} rx={7.5} fill="#FFFFFF" animatedProps={eyeProps} />
          <AnimatedEllipse cx={63} cy={76} rx={7.5} fill="#FFFFFF" animatedProps={eyeProps} />
          <AnimatedEllipse cx={38.5} cy={77} rx={4} fill={INK} animatedProps={pupilProps} />
          <AnimatedEllipse cx={64.5} cy={77} rx={4} fill={INK} animatedProps={pupilProps} />
          <Circle cx={40} cy={74.5} r={1.4} fill="#FFFFFF" />
          <Circle cx={66} cy={74.5} r={1.4} fill="#FFFFFF" />

          {/* Cheeks when happy */}
          {(mood === 'happy' || mood === 'joy') && (
            <G fill={Hue.alarm.main} opacity={0.55}>
              <Ellipse cx={25} cy={90} rx={6} ry={3.6} />
              <Ellipse cx={75} cy={90} rx={6} ry={3.6} />
            </G>
          )}

          <Path
            d={mouth.d}
            fill={mouth.filled ? INK : 'none'}
            stroke={mouth.filled ? INK : line}
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fall: { position: 'absolute', top: 0, zIndex: 2 },
});
