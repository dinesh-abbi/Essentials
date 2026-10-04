import { Image } from 'expo-image';
import { useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Sheet } from '@/components/ui/sheet';
import { Colors, Hue, Radius, Spacing, Type } from '@/constants/theme';

const ANATOMY: Record<string, any> = {
  chest: require('../../../assets/anatomy/chest.png'),
  back: require('../../../assets/anatomy/back.png'),
  shoulders: require('../../../assets/anatomy/shoulders.png'),
  abs: require('../../../assets/anatomy/abs.png'),
  biceps: require('../../../assets/anatomy/biceps.png'),
  triceps: require('../../../assets/anatomy/triceps.png'),
  forearms: require('../../../assets/anatomy/forearms.png'),
  lower_body: require('../../../assets/anatomy/lower_body.png'),
};

const LABEL: Record<string, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  abs: 'Core',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  lower_body: 'Legs & glutes',
};

const { width: W } = Dimensions.get('window');

/** Swipeable anatomy plates for the muscles today's session targets. */
export function AnatomySheet({ visible, onClose, focus }: { visible: boolean; onClose: () => void; focus: string[] }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const plates = focus.filter((f) => ANATOMY[f]);
  const [page, setPage] = useState(0);

  return (
    <Sheet visible={visible} onClose={onClose} bracket="MUSCLES" title={plates.map((p) => LABEL[p]).join(' · ')}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / W))}
      >
        {plates.map((p) => (
          <View key={p} style={[styles.page, { width: W }]}>
            <View style={[styles.plate, { borderColor: colors.hairline }]}>
              <Image source={ANATOMY[p]} style={styles.image} contentFit="contain" transition={180} />
            </View>
            <Text style={[Type.dotLabel, styles.caption, { color: Hue.train.main }]}>{LABEL[p]}</Text>
          </View>
        ))}
      </ScrollView>
      {plates.length > 1 && (
        <View style={styles.dots}>
          {plates.map((p, i) => (
            <View
              key={p}
              style={[styles.dot, { backgroundColor: i === page ? Hue.train.main : colors.surface2, width: i === page ? 22 : 8 }]}
            />
          ))}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: Spacing.four, flex: 1 },
  plate: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  image: { flex: 1 },
  caption: { textAlign: 'center', marginTop: Spacing.three },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: Spacing.three },
  dot: { height: 8, borderRadius: 4 },
});
