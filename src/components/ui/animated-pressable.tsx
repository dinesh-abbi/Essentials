import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, useReducedMotion } from 'react-native-reanimated';

import { Motion } from '@/constants/theme';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

export interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function AnimatedPressable({ children, style, ...props }: AnimatedPressableProps) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = (e: any) => {
    if (!reduceMotion) {
      scale.value = withSpring(0.96, Motion.spring);
    }
    if (props.onPressIn) {
      props.onPressIn(e);
    }
  };

  const handlePressOut = (e: any) => {
    if (!reduceMotion) {
      scale.value = withSpring(1, Motion.spring);
    }
    if (props.onPressOut) {
      props.onPressOut(e);
    }
  };

  return (
    <AnimatedPressableBase
      {...props}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressableBase>
  );
}
