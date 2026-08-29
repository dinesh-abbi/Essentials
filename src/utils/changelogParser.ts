/**
 * Parses the changelog markdown this project actually ships into structured
 * data the UI can lay out properly.
 *
 * Why hand-rolled instead of a markdown library: the release body is always
 * `changelogs/vX.Y.Z.md` (see publish-github.js — it passes that file straight
 * to `gh release create --notes-file`), so the shape is known and narrow. A
 * generic renderer would give us a wall of styled text; parsing to real
 * sections lets the viewer group by kind, colour-code each group, and show
 * counts — which is the whole point of the screen. It also avoids adding a
 * dependency (and a native rebuild) for one screen.
 *
 * The parser is deliberately forgiving: GitHub's own auto-generated notes
 * (`--generate-notes`) or a hand-written release body will still land in a
 * sane "other" section rather than rendering blank.
 */

export type SectionKind = 'features' | 'fixes' | 'ui' | 'build' | 'commits' | 'other';

export interface ChangelogItem {
  /** The `**bolded**` lead-in of a bullet, when present. */
  label?: string;
  /** Remaining bullet text (may still contain inline `**bold**` / `code`). */
  text: string;
}

export interface ChangelogSection {
  kind: SectionKind;
  /** Leading emoji from the heading, if the heading had one. */
  emoji?: string;
  /** Heading text with the emoji stripped, e.g. "New Features". */
  title: string;
  items: ChangelogItem[];
  /** Non-bullet prose under the heading — older changelogs use this style. */
  paragraphs: string[];
}

export interface ParsedChangelog {
  version?: string;
  releasedOn?: string;
  /** The bold headline sentence of the intro blurb, when present. */
  introLead?: string;
  /** Remaining intro prose. */
  introBody?: string;
  sections: ChangelogSection[];
  /** True when nothing structured could be pulled out — render raw instead. */
  isEmpty: boolean;
}

/**
 * Heading text → semantic kind, so the UI can pick an icon/colour per group.
 * Matching is word-boundary'd rather than substring: a bare `includes('ui')`
 * also matches "b-ui-ld", which silently filed "Build & Release" under UI.
 */
function classifyHeading(title: string): SectionKind {
  const t = title.toLowerCase();
  if (/\bcommits?\b/.test(t)) return 'commits';
  if (/\b(fix|fixes|fixed|bug|bugs)\b/.test(t)) return 'fixes';
  if (/\b(build|release|chore|ci|deps|dependencies)\b/.test(t)) return 'build';
  if (/\b(ui|ux|design|style|styling|polish)\b/.test(t) || t.includes('improvement')) return 'ui';
  if (/\b(feature|features|new|added|additions|highlights)\b/.test(t)) return 'features';
  return 'other';
}

/**
 * Splits a leading emoji off a heading. Matched by "not a letter/number/space"
 * rather than an emoji range list, so new/compound emoji (ZWJ sequences,
 * variation selectors) don't silently fall through as part of the title.
 */
function splitEmoji(heading: string): { emoji?: string; title: string } {
  const match = heading.match(/^([^\p{L}\p{N}\s]+)\s*(.*)$/u);
  if (match && match[1] && match[2]) {
    return { emoji: match[1].trim(), title: match[2].trim() };
  }
  return { title: heading.trim() };
}

/** Pulls `**Label**: rest` apart; returns the whole line as text otherwise. */
function splitLabel(raw: string): ChangelogItem {
  const trimmed = raw.trim();
  if (trimmed.startsWith('**')) {
    const end = trimmed.indexOf('**', 2);
    if (end > 2) {
      const label = trimmed.slice(2, end).trim();
      // Drop only a separator that immediately follows the label, so trailing
      // context like "(`constants/theme.ts`): …" survives intact.
      const rest = trimmed.slice(end + 2).replace(/^\s*[:—–-]\s*/, '').trim();
      if (label) return { label, text: rest };
    }
  }
  return { text: trimmed };
}

export function parseChangelog(markdown: string): ParsedChangelog {
  const result: ParsedChangelog = { sections: [], isEmpty: true };

  if (!markdown || !markdown.trim()) return result;

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');

  let section: ChangelogSection | null = null;
  // Tracks whether the last consumed line was a bullet, so indented wrapped
  // lines get appended to that bullet instead of becoming stray paragraphs.
  let lastItem: ChangelogItem | null = null;
  let paragraphBuffer: string[] = [];
  const introParagraphs: string[] = [];

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    const text = paragraphBuffer.join(' ').trim();
    paragraphBuffer = [];
    if (!text) return;
    if (section) section.paragraphs.push(text);
    else introParagraphs.push(text);
  };

  const pushSection = (next: ChangelogSection) => {
    flushParagraph();
    lastItem = null;
    if (section) result.sections.push(section);
    section = next;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    // Blank line closes any open paragraph/bullet continuation.
    if (!trimmed) {
      flushParagraph();
      lastItem = null;
      continue;
    }

    // Horizontal rules carry no content.
    if (/^([-*_])\1{2,}$/.test(trimmed)) {
      flushParagraph();
      lastItem = null;
      continue;
    }

    // H1 — the "# Release Changelog v1.0.20" title line.
    const h1 = trimmed.match(/^#\s+(.*)$/);
    if (h1) {
      flushParagraph();
      lastItem = null;
      const versionMatch = h1[1].match(/v?(\d+\.\d+(?:\.\d+)?)/i);
      if (versionMatch) result.version = versionMatch[1];
      continue;
    }

    // H2/H3 — section headings. Both are accepted because GitHub's
    // auto-generated notes use "## What's Changed" while our changelogs use "###".
    const heading = trimmed.match(/^#{2,6}\s+(.*)$/);
    if (heading) {
      const { emoji, title } = splitEmoji(heading[1].replace(/[*_`]/g, '').trim());
      pushSection({ kind: classifyHeading(title), emoji, title, items: [], paragraphs: [] });
      continue;
    }

    // "*Released on: Thursday, 13 August 2026*"
    const released = trimmed.match(/^\*+\s*Released on:\s*(.+?)\s*\*+$/i);
    if (released) {
      flushParagraph();
      lastItem = null;
      result.releasedOn = released[1].trim();
      continue;
    }

    // Bullet.
    const bullet = trimmed.match(/^[-*+]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      const item = splitLabel(bullet[1]);
      if (!section) {
        // Bullets before any heading (hand-written release bodies do this).
        section = { kind: 'other', title: 'Highlights', items: [], paragraphs: [] };
      }
      section.items.push(item);
      lastItem = item;
      continue;
    }

    // An indented, non-bullet line directly under a bullet is that bullet's
    // wrapped continuation — our changelogs hard-wrap at ~78 cols.
    if (lastItem && /^\s+/.test(rawLine)) {
      lastItem.text = `${lastItem.text} ${trimmed}`.trim();
      continue;
    }

    // Anything else is prose.
    lastItem = null;
    paragraphBuffer.push(trimmed);
  }

  flushParagraph();
  if (section) result.sections.push(section);

  // First intro paragraph often leads with a bold headline sentence —
  // "**The "Cockpit" design overhaul.** A full design-system pass that …"
  if (introParagraphs.length) {
    const first = introParagraphs[0];
    const leadMatch = first.match(/^\*\*(.+?)\*\*\s*(.*)$/);
    if (leadMatch) {
      result.introLead = leadMatch[1].trim();
      const rest = [leadMatch[2].trim(), ...introParagraphs.slice(1)].filter(Boolean);
      result.introBody = rest.join('\n\n') || undefined;
    } else {
      result.introBody = introParagraphs.join('\n\n');
    }
  }

  result.sections = result.sections.filter((s) => s.items.length || s.paragraphs.length);
  result.isEmpty =
    !result.sections.length && !result.introLead && !result.introBody;

  return result;
}

export type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'code'; value: string };

/**
 * Tokenises the inline markdown that survives inside item/paragraph text so
 * the renderer can style `**bold**` and `` `code` `` runs instead of showing
 * literal asterisks and backticks to the user.
 */
export function tokenizeInline(input: string): InlineToken[] {
  if (!input) return [];
  const tokens: InlineToken[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    if (match.index > cursor) {
      tokens.push({ type: 'text', value: input.slice(cursor, match.index) });
    }
    const chunk = match[0];
    if (chunk.startsWith('**')) {
      tokens.push({ type: 'bold', value: chunk.slice(2, -2) });
    } else {
      tokens.push({ type: 'code', value: chunk.slice(1, -1) });
    }
    cursor = match.index + chunk.length;
  }

  if (cursor < input.length) {
    tokens.push({ type: 'text', value: input.slice(cursor) });
  }

  return tokens;
}
