import Svg, { Path, Circle } from 'react-native-svg';

/**
 * One continuous idea (a circle plus short rays), used as the check-in card's
 * empty-state mark before a first check-in exists today.
 */
export default function Sun({ size = 40, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Circle cx="20" cy="20" r="7" stroke={color} strokeWidth={1.5} />
      <Path
        d="M20 5v4M20 31v4M35 20h-4M9 20H5M30.6 9.4l-2.8 2.8M12.2 27.8l-2.8 2.8M30.6 30.6l-2.8-2.8M12.2 12.2 9.4 9.4"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}
