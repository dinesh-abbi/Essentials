import Svg, { Path } from 'react-native-svg';

/**
 * The one warm touch this design allows itself: a single continuous outline,
 * no fill, stroke = `--water`. A glass with one droplet above it — the
 * hero's optional corner mark. Kept out of the layout flow by its callers
 * (absolute-positioned, low emphasis) so it never competes with the 84px
 * number for attention.
 */
export default function GlassDrop({ size = 40, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Path
        d="M12 16h16l-1.6 16.2a2 2 0 0 1-2 1.8H15.6a2 2 0 0 1-2-1.8L12 16Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M20 4c2.4 3.1 4 5.7 4 7.8a4 4 0 1 1-8 0C16 9.7 17.6 7.1 20 4Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
