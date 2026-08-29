import Svg, { Path } from 'react-native-svg';

/**
 * One continuous line: a stem with three simple leaves, in a low pot. The
 * check-in card's corner mark — reads as "growth / a small daily habit"
 * without leaning on a literal camera glyph.
 */
export default function Plant({ size = 40, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Path
        d="M20 34V18"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M20 18c0-4.4-3.1-8-8-9 1 4.8 3.8 8 8 9Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M20 22c0-4.4 3.1-8 8-9-1 4.8-3.8 8-8 9Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13 34h14l-1.4-8a1 1 0 0 0-1-.8H15.4a1 1 0 0 0-1 .8L13 34Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
