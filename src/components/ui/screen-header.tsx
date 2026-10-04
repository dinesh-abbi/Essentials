import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ChunkyButton } from '@/components/ui/chunky';
import { Colors, Spacing, Type } from '@/constants/theme';

const ICONS = { 'arrow-left': 'arrow-left', x: 'close', 'chevron-down': 'chevron-down' } as const;

/**
 * Header for pushed (non-tab) screens: a chunky round back button, a
 * dot-matrix label, and optional actions on the right. The screen's own big
 * title sits below it.
 */
export function ScreenHeader({
  bracket,
  onBack,
  icon = 'arrow-left',
  right,
}: {
  /** Short label; any legacy `[ … ]` brackets are stripped. */
  bracket: string;
  onBack?: () => void;
  icon?: keyof typeof ICONS;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  const back = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)' as any);
  };

  return (
    <View style={styles.row}>
      <ChunkyButton icon={ICONS[icon]} variant="soft" hue="profile" size="md" haptic="light" onPress={back} accessibilityLabel="Back" textColor={Colors.dark.textHi} />
      <Text style={[Type.dotLabel, styles.label, { color: Colors.dark.textMid }]} numberOfLines={1}>
        {bracket.replace(/^\[\s*|\s*\]$/g, '')}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  label: { flex: 1 },
  right: { flexDirection: 'row', gap: Spacing.two },
});
