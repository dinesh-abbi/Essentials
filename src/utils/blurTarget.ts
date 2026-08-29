import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { View } from 'react-native';

type ViewRef = RefObject<View | null>;

/**
 * The floating tab bar's BlurView needs a `blurTarget` ref to the specific
 * content it should blur (Android has no automatic "blur whatever is behind
 * me" like iOS — see expo-blur's BlurTargetView docs). The tab bar itself is
 * rendered by the navigator, not by any individual screen, so it has no
 * direct way to reach into whichever tab is currently focused — this tiny
 * registry is that bridge: each screen registers its own BlurTargetView ref
 * on focus, and the tab bar always reads whichever one registered last.
 */
let activeRef: ViewRef | null = null;
const listeners = new Set<() => void>();

export function registerBlurTarget(ref: ViewRef) {
  activeRef = ref;
  listeners.forEach((listener) => listener());
}

export function useActiveBlurTarget(): ViewRef | null {
  const [, tick] = useState(0);
  useEffect(() => {
    const listener = () => tick((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return activeRef;
}
