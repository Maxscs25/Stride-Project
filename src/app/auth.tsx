import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { ModalShell } from '@/components/ModalShell';
import { Field } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { radius, useTheme } from '@/theme';

export default function Auth() {
  const { colors } = useTheme();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const valid = email.includes('@') && password.length >= 8;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        router.back();
      } else {
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        if (data.session) {
          router.back();
        } else {
          setNotice('Almost there — check your email for a confirmation link, then sign in.');
          setMode('signin');
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title={mode === 'signin' ? 'Sign In' : 'Create Account'}>
      <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 18 }}>
        {mode === 'signin'
          ? 'Welcome back. Your training log syncs across devices.'
          : 'Free forever for logging. Your data stays private — you choose what a coach ever sees.'}
      </Text>

      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="8+ characters"
        autoCapitalize="none"
        secureTextEntry
      />

      {error ? (
        <Text style={{ color: colors.danger, fontSize: 13, marginBottom: 12 }}>{error}</Text>
      ) : null}
      {notice ? (
        <Text style={{ color: colors.good, fontSize: 13, marginBottom: 12 }}>{notice}</Text>
      ) : null}

      <Pressable
        onPress={submit}
        disabled={!valid || busy}
        style={{
          backgroundColor: valid && !busy ? colors.accent : colors.surfaceAlt,
          borderRadius: radius.md,
          paddingVertical: 16,
          alignItems: 'center',
        }}>
        {busy ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Text
            style={{
              color: valid ? colors.onAccent : colors.textMuted,
              fontSize: 16,
              fontWeight: '800',
            }}>
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin');
          setError(null);
        }}
        style={{ alignItems: 'center', paddingVertical: 18 }}>
        <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '700' }}>
          {mode === 'signin' ? "New here? Create an account" : 'Already have an account? Sign in'}
        </Text>
      </Pressable>

      <View
        style={{
          backgroundColor: colors.surfaceAlt,
          borderRadius: radius.md,
          padding: 12,
        }}>
        <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 17 }}>
          No account needed to explore — close this screen to keep using the demo. Signing in
          replaces the sample data with your real training log.
        </Text>
      </View>
    </ModalShell>
  );
}
