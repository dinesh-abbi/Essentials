import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import Droplet from '@/components/illustrations/Droplet';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { ChunkyButton, IconBlob, type IconName } from '@/components/ui/chunky';
import { Segmented } from '@/components/ui/segmented';
import { Colors, Radius, Spacing, Type, type HueName } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

const C = Colors.dark;
type Mode = 'login' | 'signup';

const AREAS: { icon: IconName; hue: HueName }[] = [
  { icon: 'water', hue: 'water' },
  { icon: 'dumbbell', hue: 'train' },
  { icon: 'food-apple', hue: 'fuel' },
  { icon: 'wallet', hue: 'spend' },
  { icon: 'map-marker-check', hue: 'checkin' },
  { icon: 'alarm', hue: 'alarm' },
];

/**
 * Sign in. Drip says hello, the six areas of the app bounce in a row so you
 * see what's inside before you've typed anything, then a simple form.
 */
export default function LoginScreen() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/(tabs)');
  }, [user, loading, router]);

  async function submit() {
    const e = email.trim();
    const p = password.trim();
    if (!e || !p) return Alert.alert('Almost there', 'Enter your email and password.');
    if (p.length < 6) return Alert.alert('Password too short', 'Use at least 6 characters.');
    setSubmitting(true);
    try {
      if (mode === 'login') await signInWithEmail(e, p);
      else await signUpWithEmail(e, p);
    } catch (err: any) {
      const msg =
        err?.code === 'auth/user-not-found' || err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential'
          ? 'Wrong email or password.'
          : err?.code === 'auth/email-already-in-use'
            ? 'That email already has an account — sign in instead.'
            : err?.message ?? 'Something went wrong.';
      Alert.alert('Couldn’t sign in', msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function google() {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } finally {
      setGoogleLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: C.bg }]}>
        <ActivityIndicator size="large" color={C.water} />
      </View>
    );
  }

  const enter = (d: number) => (reduceMotion ? undefined : FadeInDown.delay(d).springify().damping(16));

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Animated.View entering={enter(0)} style={styles.hello}>
              <Droplet ratio={0.75} size={96} />
              <Text style={[Type.largeTitle, { color: C.textHi }]}>Essentials</Text>
              <Text style={[Type.body, { color: C.textMid }]}>Your whole day, at a glance.</Text>
            </Animated.View>

            <Animated.View entering={enter(120)} style={styles.areas}>
              {AREAS.map((a, i) => (
                <Bouncer key={a.icon} index={i}>
                  <IconBlob name={a.icon} hue={a.hue} size={44} />
                </Bouncer>
              ))}
            </Animated.View>

            <Animated.View entering={enter(220)} style={styles.form}>
              <Segmented
                hue="profile"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'login', label: 'Sign in' },
                  { value: 'signup', label: 'New account' },
                ]}
              />
              <Field icon="email-outline">
                <TextInput
                  style={[Type.controlLabel, styles.input, { color: C.textHi }]}
                  placeholder="Email"
                  placeholderTextColor={C.textLow}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  returnKeyType="next"
                />
              </Field>
              <Field icon="lock-outline">
                <TextInput
                  style={[Type.controlLabel, styles.input, { color: C.textHi }]}
                  placeholder="Password"
                  placeholderTextColor={C.textLow}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  returnKeyType="done"
                  onSubmitEditing={submit}
                />
                <AnimatedPressable onPress={() => setShowPass((s) => !s)} hitSlop={10} accessibilityLabel={showPass ? 'Hide password' : 'Show password'}>
                  <MaterialCommunityIcons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.textMid} />
                </AnimatedPressable>
              </Field>
              <ChunkyButton label={mode === 'login' ? 'Sign in' : 'Create account'} icon="arrow-right" hue="profile" onPress={submit} loading={submitting} />
            </Animated.View>

            <Animated.View entering={enter(320)} style={styles.or}>
              <View style={[styles.line, { backgroundColor: C.hairline }]} />
              <Text style={[Type.dotLabel, { color: C.textLow }]}>or</Text>
              <View style={[styles.line, { backgroundColor: C.hairline }]} />
            </Animated.View>

            <Animated.View entering={enter(400)}>
              <ChunkyButton label="Continue with Google" icon="google" variant="soft" hue="water" onPress={google} loading={googleLoading} />
            </Animated.View>

            <Text style={[Type.subline, styles.footer, { color: C.textLow }]}>By continuing you agree to the Terms of Service.</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/** Each area icon hops in turn, like a little wave. */
function Bouncer({ index, children }: { index: number; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    y.value = withDelay(
      600 + index * 120,
      withRepeat(withSequence(withSpring(-10, { damping: 6, stiffness: 260 }), withSpring(0, { damping: 8 }), withTiming(0, { duration: 2000 })), -1, false),
    );
  }, [index, reduceMotion, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function Field({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  return (
    <View style={[styles.field, { backgroundColor: C.surface }]}>
      <MaterialCommunityIcons name={icon} size={20} color={C.textMid} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.four, paddingVertical: Spacing.five, justifyContent: 'center', gap: Spacing.four },
  hello: { alignItems: 'center', gap: 6 },
  areas: { flexDirection: 'row', justifyContent: 'space-between' },
  form: { gap: 12 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: Radius.lg, paddingHorizontal: 16, height: 56 },
  input: { flex: 1, padding: 0 },
  or: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  footer: { textAlign: 'center' },
});
