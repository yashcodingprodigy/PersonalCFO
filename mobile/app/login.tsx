// Sign in: email one-time code (primary), mobile OTP (existing accounts), or the demo account.
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { C, SP } from '@/lib/theme';
import { Button, Card, H1, Input, Screen, Segmented, Small, Soft, Tiny, Txt, Gap } from '@/components/ui';

export default function Login() {
  const { signIn } = useAuth();
  const { t } = useLang();
  const [method, setMethod] = useState<'email' | 'mobile'>('email');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [err, setErr] = useState('');
  const fullMobile = `+91${mobile.replace(/\D/g, '').slice(-10)}`;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const mobileOk = mobile.replace(/\D/g, '').length === 10;

  async function send() {
    setErr(''); setBusy(true);
    try {
      if (method === 'email') await api('/auth/email/send', { method: 'POST', body: { email: email.trim().toLowerCase() } });
      else await api('/auth/otp/send', { method: 'POST', body: { mobile: fullMobile } });
      setSent(true);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  async function verify() {
    setErr(''); setBusy(true);
    try {
      const res: any = method === 'email'
        ? await api('/auth/email/verify', { method: 'POST', body: { email: email.trim().toLowerCase(), otp } })
        : await api('/auth/otp/verify', { method: 'POST', body: { mobile: fullMobile, otp } });
      await signIn(res);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  async function demo() {
    setErr(''); setDemoBusy(true);
    try { const res: any = await api('/auth/demo', { method: 'POST', body: {} }); await signIn(res); }
    catch (e: any) { setErr(e.message); } finally { setDemoBusy(false); }
  }

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']} contentStyle={{ padding: SP.xl }}>
      <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back"><Txt style={{ color: C.pine700, fontWeight: '700' }}>‹ Back</Txt></Pressable>
      <Gap h={SP.xl} />
      <H1>{t('login.title')}</H1>
      <Soft style={{ marginTop: 6 }}>We’ll send you a one-time code. No passwords.</Soft>
      <Gap h={SP.xl} />
      <Card>
        <Segmented options={[{ v: 'email', label: 'Email' }, { v: 'mobile', label: 'Mobile' }]} value={method}
          onChange={(m) => { setMethod(m); setSent(false); setOtp(''); setErr(''); }} />
        <Gap h={SP.lg} />
        {method === 'email' ? (
          <Input label={t('login.email')} value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address"
            autoCapitalize="none" autoComplete="email" textContentType="emailAddress" editable={!sent} />
        ) : (
          <Input label="Mobile number" value={mobile} onChangeText={(s) => setMobile(s.replace(/\D/g, '').slice(0, 10))} placeholder="98765 43210"
            keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" editable={!sent}
            hint="For accounts created with a mobile number. New here? Use email." />
        )}
        {sent && (
          <Input label={t('login.code')} value={otp} onChangeText={(s) => setOtp(s.replace(/\D/g, '').slice(0, 6))} placeholder="••••••"
            keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" autoFocus
            hint={method === 'email' ? `Sent to ${email.trim()}. Check spam if you don’t see it.` : `Sent to ${fullMobile}.`} />
        )}
        {err ? <Small style={{ color: C.red, marginBottom: 10 }}>{err}</Small> : null}
        {!sent ? (
          <Button title={t('login.sendCode')} onPress={send} loading={busy} disabled={method === 'email' ? !emailOk : !mobileOk} />
        ) : (
          <>
            <Button title={t('login.verify')} onPress={verify} loading={busy} disabled={otp.length !== 6} />
            <Button kind="ghost" title="Change / resend" onPress={() => { setSent(false); setOtp(''); }} style={{ marginTop: 6 }} />
          </>
        )}
      </Card>
      <Gap h={SP.lg} />
      <Button kind="secondary" title={t('login.demo')} icon="sparkles-outline" onPress={demo} loading={demoBusy} />
      <Tiny style={{ textAlign: 'center', marginTop: 8 }}>Demo data only — a sample person’s finances, reset every time.</Tiny>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 28 }}>
        <Pressable onPress={() => router.push('/legal/terms')}><Tiny style={{ textDecorationLine: 'underline' }}>Terms</Tiny></Pressable>
        <Pressable onPress={() => router.push('/legal/privacy')}><Tiny style={{ textDecorationLine: 'underline' }}>Privacy</Tiny></Pressable>
        <Pressable onPress={() => router.push('/legal/disclosures')}><Tiny style={{ textDecorationLine: 'underline' }}>Disclosures</Tiny></Pressable>
      </View>
      <Tiny style={{ textAlign: 'center', marginTop: 10 }}>By continuing you agree to the Terms and Privacy Policy.</Tiny>
    </Screen>
  );
}
