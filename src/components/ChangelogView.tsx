import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { Chip, IconBlob, Tile, type IconName } from '@/components/ui/chunky';
import { Colors, FontFace, Hue, Motion, Spacing, Type, type HueName } from '@/constants/theme';
import { parseChangelog, tokenizeInline, type ChangelogSection, type SectionKind } from '@/utils/changelogParser';

const C = Colors.dark;

/** Each kind of change gets a picture and a hue, so sections read before their titles. */
const KIND_META: Record<SectionKind, { icon: IconName; hue: HueName }> = {
  features: { icon: 'star-four-points', hue: 'water' },
  fixes: { icon: 'bandage', hue: 'fuel' },
  ui: { icon: 'palette', hue: 'checkin' },
  build: { icon: 'wrench', hue: 'spend' },
  commits: { icon: 'source-commit', hue: 'profile' },
  other: { icon: 'information-variant', hue: 'profile' },
};

/** Renders `**bold**` / `` `code` `` runs instead of leaking the raw markers. */
function InlineText({ content, style }: { content: string; style: any }) {
  return (
    <Text style={style}>
      {tokenizeInline(content).map((token, index) =>
        token.type === 'bold' ? (
          <Text key={index} style={{ fontFamily: FontFace.display, color: C.textHi }}>
            {token.value}
          </Text>
        ) : token.type === 'code' ? (
          <Text key={index} style={{ fontFamily: FontFace.dot, color: C.textHi, backgroundColor: C.surface2 }}>
            {token.value}
          </Text>
        ) : (
          <Text key={index}>{token.value}</Text>
        ),
      )}
    </Text>
  );
}

function SectionCard({ section, index, wide }: { section: ChangelogSection; index: number; wide: boolean }) {
  const reduceMotion = useReducedMotion();
  const meta = KIND_META[section.kind];
  const color = Hue[meta.hue].main;
  const count = section.items.length || section.paragraphs.length;

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.delay(120 + index * Motion.stagger).springify().damping(18)}
      style={wide ? styles.cardWide : null}
    >
      <Tile style={styles.card}>
        <View style={styles.cardHeader}>
          <IconBlob name={meta.icon} hue={meta.hue} size={38} />
          <Text style={[Type.title, styles.flex, { color: C.textHi, fontSize: 18 }]} numberOfLines={2}>
            {section.title.replace(/^[^\p{L}\p{N}]+/u, '')}
          </Text>
          <Chip label={`${count}`} hue={meta.hue} />
        </View>
        <View style={styles.cardBody}>
          {section.paragraphs.map((p, i) => (
            <InlineText key={`p-${i}`} content={p} style={[Type.body, { color: C.textMid }]} />
          ))}
          {section.items.map((item, i) => (
            <View key={`i-${i}`} style={styles.item}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <View style={styles.flex}>
                {item.label ? <InlineText content={item.label} style={[Type.controlLabel, { color: C.textHi }]} /> : null}
                {item.text ? (
                  <InlineText content={item.text} style={[section.kind === 'commits' ? Type.subline : Type.body, { color: C.textMid }]} />
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </Tile>
    </Animated.View>
  );
}

export interface ChangelogViewProps {
  /** Raw release-body markdown. */
  markdown: string;
  /** Version to show in the header pill — falls back to the parsed one. */
  version?: string;
  /** Small line above the version, e.g. "Update available" / "Installed". */
  eyebrow?: string;
}

/**
 * Full-width changelog reader. Presentational only — the update prompt and
 * Profile's release-notes screen both render this, so it never owns fetching,
 * navigation, or install state.
 */
export default function ChangelogView({ markdown, version, eyebrow }: ChangelogViewProps) {
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const parsed = React.useMemo(() => parseChangelog(markdown), [markdown]);
  const wide = width >= 700;
  const shownVersion = version ?? parsed.version;

  return (
    <View style={styles.root}>
      <Animated.View entering={reduceMotion ? undefined : FadeInDown.springify().damping(18)} style={styles.hero}>
        {eyebrow ? <Text style={[Type.dotLabel, { color: C.water }]}>{eyebrow}</Text> : null}
        <View style={styles.versionRow}>
          {shownVersion ? <Chip icon="tag" label={`v${shownVersion}`} hue="water" solid /> : null}
          {parsed.releasedOn ? (
            <Text style={[Type.subline, styles.shrink, { color: C.textMid }]} numberOfLines={1}>
              {parsed.releasedOn}
            </Text>
          ) : null}
        </View>
        {parsed.introLead ? <Text style={[Type.headline, { color: C.textHi }]}>{parsed.introLead}</Text> : null}
        {parsed.introBody ? <InlineText content={parsed.introBody} style={[Type.body, { color: C.textMid }]} /> : null}
      </Animated.View>

      {parsed.isEmpty ? (
        <Tile>
          <Text style={[Type.body, { color: C.textMid }]}>
            {markdown?.trim() ? markdown.trim() : 'No release notes were published for this version.'}
          </Text>
        </Tile>
      ) : (
        <View style={[styles.grid, wide ? styles.gridWide : null]}>
          {parsed.sections.map((section, index) => (
            <SectionCard key={`${section.title}-${index}`} section={section} index={index} wide={wide} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', gap: Spacing.four },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  hero: { gap: 10 },
  versionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  grid: { gap: 6 },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cardWide: { flexGrow: 1, flexBasis: '47%' },
  card: { gap: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardBody: { gap: 12 },
  item: { flexDirection: 'row', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
});
