import Svg, { Path } from 'react-native-svg';

/**
 * A loaded barbell seen side-on — two plates a side, one continuous bar.
 * Same 1.5 stroke, round caps and 40-unit box as Plant / Sun / Wallet so it
 * reads as part of the set rather than an icon-font glyph.
 */
export default function Barbell({ size = 40, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Path d="M4 20h32" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M9 13.5v13M12.5 11v18" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M31 13.5v13M27.5 11v18" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}
