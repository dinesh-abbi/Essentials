import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { FontFace, Fonts, Motion, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  parseChangelog,
  tokenizeInline,
  type ChangelogSection,
  type SectionKind,
} from '@/utils/changelogParser';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

/**
 * Per-kind icon + colour role. Semantic, not decorative: green reads "fixed",
 * amber reads "plumbing you don't have to care about", the signal azure is
 * reserved for what's actually new.
 */
const KIND_META: Record<SectionKind, { icon: FeatherName; colorKey: 'signal' | 'success' | 'aqua' | 'warn' | 'textFaint' | 'textSecondary' }> = {
  features: { icon: 'zap', colorKey: 'signal' },
  fixes: { icon: 'check-circle', colorKey: 'success' },
  ui: { icon: 'layout', colorKey: 'aqua' },
  build: { icon: 'package', colorKey: 'warn' },
  commits: { icon: 'git-commit', colorKey: 'textFaint' },
  other: { icon: 'info', colorKey: 'textSecondary' },
};

/** Renders `**bold**` / `` `code` `` runs instead of leaking the raw markers. */
function InlineText({
  content,
  style,
  boldColor,
  codeBackground,
}: {
  content: string;
  style: any;
  boldColor: string;
  codeBackground: string;
}) {
  const tokens = tokenizeInline(content);
  return (
    <Text style={style}>
      {tokens.map((token, index) => {
        if (token.type === 'bold') {
          return (
            <Text key={index} style={{ fontFamily: FontFace.bold, color: boldColor }}>
              {token.value}
            </Text>
          );
        }
        if (token.type === 'code') {
          return (
            <Text
              key={index}
              style={{
                fontFamily: Fonts?.mono,
                fontSize: 12.5,
                color: boldColor,
                backgroundColor: codeBackground,
              }}
            >
              {token.value}
            </Text>
          );
        }
        return <Text key={index}>{token.value}</Text>;
      })}
    </Text>
  );
}

function SectionCard({
  section,
  index,
  wide,
}: {
  section: ChangelogSection;
  index: number;
  wide: boolean;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const meta = KIND_META[section.kind];
  const accent = theme[meta.colorKey];
  const count = section.items.length || section.paragraphs.length;

  const entering = reduceMotion
    ? undefined
    : FadeInDown.delay(120 + index * Motion.stagger).duration(Motion.duration.base);

  return (
    <Animated.View
      entering={entering}
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
        },
        // On a tablet/landscape the cards pair up instead of running one very
        // long column; on a phone they stay full width.
        wide ? styles.cardWide : null,
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.cardIcon, { backgroundColor: accent + '1F' }]}>
          <Feather name={meta.icon} size={15} color={accent} />
        </View>
        <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>
          {section.title}
        </Text>
        <View style={[styles.countPill, { backgroundColor: theme.backgroundSelected }]}>
          <Text style={[styles.countText, { color: theme.textSecondary }]}>{count}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        {section.paragraphs.map((paragraph, i) => (
          <InlineText
            key={`p-${i}`}
            content={paragraph}
            style={[styles.paragraph, { color: theme.textSecondary }]}
            boldColor={theme.text}
            codeBackground={theme.surfaceSunken}
          />
        ))}

        {section.items.map((item, i) => (
          <View key={`i-${i}`} style={styles.item}>
            {/* Commit lines are already terse and uniform — a bullet dot reads
                better there than the accent bar used for prose items. */}
            {section.kind === 'commits' ? (
              <View style={[styles.commitDot, { backgroundColor: accent }]} />
            ) : (
              <View style={[styles.itemBar, { backgroundColor: accent + '55' }]} />
            )}
            <View style={styles.itemTextWrap}>
              {item.label ? (
                <InlineText
                  content={item.label}
                  style={[styles.itemLabel, { color: theme.text }]}
                  boldColor={theme.text}
                  codeBackground={theme.surfaceSunken}
                />
              ) : null}
              {item.text ? (
                <InlineText
                  content={item.text}
                  style={[
                    section.kind === 'commits' ? styles.commitText : styles.itemText,
                    { color: theme.textSecondary },
                  ]}
                  boldColor={theme.text}
                  codeBackground={theme.surfaceSunken}
                />
              ) : null}
            </View>
          </View>
        ))}
      </View>
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
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const parsed = React.useMemo(() => parseChangelog(markdown), [markdown]);

  // One breakpoint, matched to where a single column starts looking stretched.
  const wide = width >= 700;
  const shownVersion = version ?? parsed.version;

  const headerEntering = reduceMotion ? undefined : FadeInDown.duration(Motion.duration.base);

  return (
    <View style={styles.root}>
      <Animated.View entering={headerEntering} style={styles.hero}>
        {eyebrow ? (
          <Text style={[styles.eyebrow, { color: theme.signal }]}>{eyebrow}</Text>
        ) : null}

        <View style={styles.versionRow}>
          {shownVersion ? (
            <View style={[styles.versionPill, { backgroundColor: theme.signalWeak, borderColor: theme.signalLine }]}>
              <Text style={[styles.versionText, { color: theme.signal }]}>v{shownVersion}</Text>
            </View>
          ) : null}
          {parsed.releasedOn ? (
            <Text style={[styles.releasedOn, { color: theme.textFaint }]} numberOfLines={1}>
              {parsed.releasedOn}
            </Text>
          ) : null}
        </View>

        {parsed.introLead ? (
          <Text style={[styles.introLead, { color: theme.text }]}>{parsed.introLead}</Text>
        ) : null}
        {parsed.introBody ? (
          <InlineText
            content={parsed.introBody}
            style={[styles.introBody, { color: theme.textSecondary }]}
            boldColor={theme.text}
            codeBackground={theme.surfaceSunken}
          />
        ) : null}
      </Animated.View>

      {parsed.isEmpty ? (
        // Never show a blank screen: a hand-written or auto-generated release
        // body that doesn't match our changelog shape still gets displayed.
        <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
            {markdown?.trim() ? markdown.trim() : 'No release notes were published for this version.'}
          </Text>
        </View>
      ) : (
        <View style={[styles.grid, wide ? styles.gridWide : null]}>
          {parsed.sections.map((section, index) => (
            <SectionCard
              key={`${section.title}-${index}`}
              section={section}
              index={index}
              wide={wide}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: Spacing.four,
  },

  // ── Hero ────────────────────────────────────────────────────────────────────
  hero: {
    gap: Spacing.two,
  },
  eyebrow: {
    ...Type.label,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  versionPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  versionText: {
    ...Type.readout,
    fontSize: 15,
    fontFamily: FontFace.regular,
  },
  releasedOn: {
    ...Type.body,
    fontSize: 12.5,
    fontFamily: FontFace.regular,
    flexShrink: 1,
  },
  introLead: {
    ...Type.display,
    marginTop: Spacing.one,
  },
  introBody: {
    ...Type.body,
  },

  // ── Section grid ────────────────────────────────────────────────────────────
  grid: {
    gap: Spacing.three,
  },
  gridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  cardWide: {
    // Two per row with the grid's gap accounted for.
    flexGrow: 1,
    flexBasis: '47%',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  cardIcon: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    ...Type.title,
    fontSize: 16,
    fontFamily: FontFace.regular,
    flex: 1,
  },
  countPill: {
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    alignItems: 'center',
  },
  countText: {
    ...Type.readout,
    fontSize: 11.5,
    fontFamily: FontFace.regular,
  },
  cardBody: {
    gap: Spacing.three,
  },
  item: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  // A hairline accent rail instead of a bullet glyph — keeps multi-line items
  // visually attached to their own block when several wrap.
  itemBar: {
    width: 2.5,
    borderRadius: 2,
    alignSelf: 'stretch',
    marginTop: 2,
    marginBottom: 2,
  },
  commitDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 7,
  },
  itemTextWrap: {
    flex: 1,
    gap: 2,
  },
  itemLabel: {
    fontSize: 14,
    fontFamily: FontFace.bold,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  itemText: {
    ...Type.body,
    fontSize: 13.5,
    fontFamily: FontFace.regular,
    lineHeight: 20,
  },
  commitText: {
    ...Type.readout,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FontFace.regular,
  },
  paragraph: {
    ...Type.body,
    fontSize: 13.5,
    fontFamily: FontFace.regular,
    lineHeight: 20,
  },
});
