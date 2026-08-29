import Svg, { Path } from 'react-native-svg';

/**
 * One continuous line: a simple billfold with a single flap-line accent — the
 * spend card's corner mark. Deliberately not the credit-card glyph the
 * previous passes used; this is a hand-drawn outline, not an icon-font glyph.
 */
export default function Wallet({ size = 40, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Path
        d="M8 14a3 3 0 0 1 3-3h16a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3V14Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 17h20"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M25 23.5a2 2 0 1 1 4 0 2 2 0 0 1-4 0Z"
        stroke={color}
        strokeWidth={1.5}
      />
    </Svg>
  );
}
