import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Hue, Lip, Motion, NeutralTile, Radius, Type, type HueName } from '@/constants/theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const C = Colors.dark;

const HAPTIC = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  selection: () => Haptics.selectionAsync(),
} as const;

/**
 * The press behaviour shared by every chunky surface: the face sits on a
 * darker lip and sinks onto it on press-in, then springs back up. This is the
 * one depth cue in the system — it tells you "this can be pressed" without a
 * word of copy.
 */
function useSink(depth: number) {
  const reduceMotion = useReducedMotion();
  const press = useSharedValue(0);
  const faceStyle = useAnimatedStyle(() => ({ transform: [{ translateY: press.value * depth }] }));
  const down = () => {
    press.value = reduceMotion ? 1 : withTiming(1, { duration: 70 });
  };
  const up = () => {
    press.value = reduceMotion ? 0 : withSpring(0, Motion.bouncy);
  };
  return { faceStyle, down, up };
}

// ─── ChunkyButton ─────────────────────────────────────────────────────────────

const HEIGHT = { lg: 56, md: 46, sm: 38 } as const;
const ICON = { lg: 22, md: 20, sm: 17 } as const;

/**
 * A big, tactile button. `solid` paints the hue; `soft` is a neutral face
 * with a hue-coloured icon. With no `label` it renders as a round icon button.
 */
export function ChunkyButton({
  label,
  icon,
  hue = 'water',
  variant = 'solid',
  size = 'lg',
  onPress,
  disabled,
  loading,
  haptic = 'medium',
  style,
  textColor,
  accessibilityLabel,
}: {
  label?: string;
  icon?: IconName;
  hue?: HueName;
  variant?: 'solid' | 'soft';
  size?: keyof typeof HEIGHT;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  haptic?: keyof typeof HAPTIC | null;
  style?: StyleProp<ViewStyle>;
  /** Override the label/icon colour (e.g. a destructive soft button). */
  textColor?: string;
  accessibilityLabel?: string;
}) {
  const h = HEIGHT[size];
  const lip = size === 'sm' ? Lip - 1 : Lip;
  const { faceStyle, down, up } = useSink(lip);
  const set = Hue[hue];
  const off = disabled && !loading;
  const face = off ? C.surface2 : variant === 'solid' ? set.main : C.surface2;
  const edge = off ? NeutralTile.tileEdge : variant === 'solid' ? set.deep : NeutralTile.tileEdge;
  const ink = textColor ?? (off ? C.textMid : variant === 'solid' ? set.on : C.textHi);
  const iconInk = textColor ?? (off ? C.textMid : variant === 'solid' ? set.on : set.main);
  const round = !label;
  const radius = round ? h / 2 : size === 'lg' ? Radius.lg : Radius.md;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      onPressIn={() => {
        if (haptic) HAPTIC[haptic]().catch(() => {});
        down();
      }}
      onPressOut={up}
      style={[{ height: h + lip, borderRadius: radius }, round && { width: h }, style]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <View style={[styles.lip, { top: lip, backgroundColor: edge, borderRadius: radius }]} />
      <Animated.View
        style={[
          styles.face,
          { height: h, borderRadius: radius, backgroundColor: face, paddingHorizontal: round ? 0 : size === 'sm' ? 14 : 20 },
          faceStyle,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={ink} />
        ) : (
          <>
            {icon ? <MaterialCommunityIcons name={icon} size={ICON[size]} color={iconInk} /> : null}
            {label ? (
              <Text style={[Type.controlLabel, size === 'sm' && styles.smLabel, { color: ink }]} numberOfLines={1}>
                {label}
              </Text>
            ) : null}
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ─── Tile ─────────────────────────────────────────────────────────────────────

/**
 * A chunky card. Tinted with a hue it says which part of life it belongs to;
 * neutral it's just a container. Pressable tiles sink like buttons.
 */
export function Tile({
  hue,
  onPress,
  children,
  style,
  containerStyle,
  accessibilityLabel,
  haptic = 'light',
  tint,
}: {
  hue?: HueName | null;
  onPress?: () => void;
  children: ReactNode;
  /** Applied to the face (padding, layout). */
  style?: StyleProp<ViewStyle>;
  /** Applied to the outer box (flex, margins). */
  containerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  haptic?: keyof typeof HAPTIC | null;
  /** Explicit face/edge colours (overrides `hue`). */
  tint?: { face: string; edge: string };
}) {
  const { faceStyle, down, up } = useSink(Lip - 1);
  const face = tint?.face ?? (hue ? Hue[hue].tile : NeutralTile.tile);
  const edge = tint?.edge ?? (hue ? Hue[hue].tileEdge : NeutralTile.tileEdge);

  const body = (
    <>
      <View style={[styles.lip, { top: Lip, backgroundColor: edge, borderRadius: Radius.xl }]} />
      <Animated.View style={[styles.tileFace, { backgroundColor: face }, style, onPress ? faceStyle : null]}>
        {children}
      </Animated.View>
    </>
  );

  if (!onPress) return <View style={[styles.tileBox, containerStyle]}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        if (haptic) HAPTIC[haptic]().catch(() => {});
        down();
      }}
      onPressOut={up}
      style={[styles.tileBox, containerStyle]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {body}
    </Pressable>
  );
}

// ─── IconBlob ─────────────────────────────────────────────────────────────────

/** A hue-filled rounded square holding one icon — the visual "name" of a thing. */
export function IconBlob({
  name,
  hue = 'water',
  size = 44,
  variant = 'solid',
  style,
}: {
  name: IconName;
  hue?: HueName;
  size?: number;
  variant?: 'solid' | 'soft' | 'muted';
  style?: StyleProp<ViewStyle>;
}) {
  const set = Hue[hue];
  const bg = variant === 'solid' ? set.main : variant === 'soft' ? set.soft : C.surface2;
  const ink = variant === 'solid' ? set.on : variant === 'soft' ? set.main : C.textLow;
  return (
    <View style={[{ width: size, height: size, borderRadius: size * 0.34, backgroundColor: bg }, styles.center, style]}>
      <MaterialCommunityIcons name={name} size={Math.round(size * 0.55)} color={ink} />
    </View>
  );
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

/** A small rounded fact: icon + a few words. */
export function Chip({
  icon,
  label,
  hue,
  solid,
  style,
}: {
  icon?: IconName;
  label: string;
  hue?: HueName;
  solid?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const set = hue ? Hue[hue] : null;
  const bg = set ? (solid ? set.main : set.soft) : C.surface2;
  const ink = set ? (solid ? set.on : set.main) : C.textMid;
  return (
    <View style={[styles.chip, { backgroundColor: bg }, style]}>
      {icon ? <MaterialCommunityIcons name={icon} size={14} color={ink} /> : null}
      <Text style={[Type.badge, { color: ink }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lip: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  face: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  smLabel: { fontSize: 14, lineHeight: 18 },
  tileBox: { paddingBottom: Lip },
  tileFace: { borderRadius: Radius.xl, padding: 16, flexGrow: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
    alignSelf: 'flex-start',
  },
});
