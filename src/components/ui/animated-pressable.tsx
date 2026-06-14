import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

export interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function AnimatedPressable({ children, style, ...props }: AnimatedPressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = (e: any) => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 200 });
    if (props.onPressIn) {
      props.onPressIn(e);
    }
  };

  const handlePressOut = (e: any) => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
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
