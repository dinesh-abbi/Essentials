import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useAuth } from '@/contexts/AuthContext';
import { Colors, Radius, Spacing } from '@/constants/theme';

type Mode = 'login' | 'signup';

export default function LoginScreen() {
  const router = useRouter();
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Once logged in, navigate away
  useEffect(() => {
    if (!loading && user) {
      router.replace('/(tabs)');
    }
  }, [user, loading]);

  // Animated underline for mode toggle
  const underlineX = useSharedValue(0);
  const underlineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: underlineX.value }],
  }));

  function switchMode(next: Mode) {
    setMode(next);
    underlineX.value = withSpring(next === 'login' ? 0 : 110, { damping: 15 });
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    const trimEmail = email.trim();
    const trimPass = password.trim();

    if (!trimEmail || !trimPass) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    if (trimPass.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(trimEmail, trimPass);
      } else {
        await signUpWithEmail(trimEmail, trimPass);
      }
    } catch (err: any) {
      const msg =
        err?.code === 'auth/user-not-found' || err?.code === 'auth/wrong-password'
          ? 'Invalid email or password.'
          : err?.code === 'auth/email-already-in-use'
          ? 'This email is already registered. Try signing in.'
          : err?.message ?? 'Something went wrong.';
      Alert.alert('Authentication failed', msg);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Google ──────────────────────────────────────────────────────────────────
  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } finally {
      setGoogleLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.loadingRoot, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Wordmark ──────────────────────────────────────────────────── */}
            <Animated.View entering={FadeIn.duration(600)} style={styles.wordmarkBlock}>
              <Image
                source={require('@/assets/logo/Essentials.png')}
                style={{ width: 80, height: 80 }}
                contentFit="contain"
              />
              <Text style={[styles.appName, { color: colors.text }]}>Essentials</Text>
              <Text style={[styles.tagline, { color: colors.textSecondary }]}>
                Your daily life, organised.
              </Text>
            </Animated.View>

            {/* ── Mode Toggle ───────────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.modeRow}>
              <TouchableOpacity onPress={() => switchMode('login')} activeOpacity={0.7}>
                <Text style={[styles.modeLabel, { color: mode === 'login' ? colors.text : colors.textSecondary }]}>
                  Sign In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => switchMode('signup')} activeOpacity={0.7}>
                <Text style={[styles.modeLabel, { color: mode === 'signup' ? colors.text : colors.textSecondary }]}>
                  Create Account
                </Text>
              </TouchableOpacity>

              {/* Sliding underline */}
              <View style={[styles.modeTrack, { backgroundColor: colors.border }]}>
                <Animated.View style={[styles.modeUnderline, { backgroundColor: colors.primary }, underlineStyle]} />
              </View>
            </Animated.View>

            {/* ── Form ──────────────────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.form}>

              {/* Email */}
              <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
                <Feather name="mail" size={16} color={colors.textSecondary} />
                <TextInput
                  id="login-email"
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Email address"
                  placeholderTextColor={colors.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  returnKeyType="next"
                />
              </View>

              {/* Password */}
              <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
                <Feather name="lock" size={16} color={colors.textSecondary} />
                <TextInput
                  id="login-password"
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Password"
                  placeholderTextColor={colors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)} hitSlop={8}>
                  <Feather name={showPass ? 'eye-off' : 'eye'} size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Submit */}
              <TouchableOpacity
                id="login-submit"
                style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitText}>
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* ── Divider ───────────────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerLabel, { color: colors.textSecondary }]}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </Animated.View>

            {/* ── Google Button ─────────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(400).duration(500)}>
              <TouchableOpacity
                id="google-signin"
                style={[
                  styles.googleBtn,
                  {
                    backgroundColor: colors.backgroundElement,
                    borderColor: colors.border,
                  },
                ]}
                onPress={handleGoogle}
                disabled={googleLoading}
                activeOpacity={0.85}
              >
                {googleLoading ? (
                  <ActivityIndicator color={colors.text} size="small" />
                ) : (
                  <>
                    <View style={styles.googleIcon}>
                      <Text style={styles.googleG}>G</Text>
                    </View>
                    <Text style={[styles.googleText, { color: colors.text }]}>
                      Continue with Google
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* ── Footer ────────────────────────────────────────────────────── */}
            <Animated.View entering={FadeInUp.delay(500).duration(500)} style={styles.footer}>
              <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                By continuing, you agree to our Terms of Service.
              </Text>
            </Animated.View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  kav: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 32,
    justifyContent: 'center',
    gap: 24,
  },

  // ── Wordmark ────────────────────────────────────────────────────────────────
  wordmarkBlock: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoLetter: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  appName: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1.2,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '400',
  },

  // ── Mode toggle ─────────────────────────────────────────────────────────────
  modeRow: {
    flexDirection: 'row',
    gap: 32,
    position: 'relative',
  },
  modeLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    paddingBottom: 8,
  },
  modeTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },
  modeUnderline: {
    position: 'absolute',
    width: 80,
    height: 2,
    borderRadius: 1,
  },

  // ── Form ────────────────────────────────────────────────────────────────────
  form: {
    gap: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
  },
  submitBtn: {
    borderRadius: Radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // ── Divider ─────────────────────────────────────────────────────────────────
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerLabel: {
    fontSize: 13,
    fontWeight: '500',
  },

  // ── Google ──────────────────────────────────────────────────────────────────
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: 14,
    gap: 10,
  },
  googleIcon: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleG: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  googleText: {
    fontSize: 15,
    fontWeight: '600',
  },
  googleNote: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '400',
  },

  // ── Footer ──────────────────────────────────────────────────────────────────
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
