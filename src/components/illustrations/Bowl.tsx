import Svg, { Path } from 'react-native-svg';

/**
 * A shallow bowl with a single curl of steam — the Fuel mark. Matches the
 * line weight and box of the other illustrations.
 */
export default function Bowl({ size = 40, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Path
        d="M7 21h26c0 6.6-5.8 12-13 12S7 27.6 7 21Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M15 33h10" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Path
        d="M20 16c-1.6-1.4-1.6-3.1 0-4.5s1.6-3.1 0-4.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}
