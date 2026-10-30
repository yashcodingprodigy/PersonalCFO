// Settings — your details, money inputs, tax inputs, work & benefits, language, security,
// and your data rights (export + permanent in-app account deletion, as Apple/Google require).
import React, { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, Switch, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { api, get, patch, post, put, del, WEB_URL } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { inr, paiseToRupeesStr, rupeesToPaise } from '@/lib/format';
import { shareText } from '@/lib/files';
import { STATES, citiesForState } from '@/lib/india';
import { BIOLOCK_KEY } from '@/lib/prefs';
import { C, SP } from '@/lib/theme';
import { Button, Card, Disclaimer, Input, Label, Loading, MoneyInput, Row, Screen, Segmented, Select, Small, Soft, Tiny, Txt, H3, Icon } from '@/components/ui';

type Tab = 'you' | 'money' | 'tax' | 'work' | 'app';

export default function Settings() {
  const { me, refreshMe, signOut } = useAuth();
  const { lang, setLang, t } = useLang();
  const prof = useApi<any>('/user/profile');
  const [tab, setTab] = useState<Tab>('you');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };

  // details
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [age, setAge] = useState('');
  const [emp, setEmp] = useState('salaried'); const [deps, setDeps] = useState('0'); const [st, setSt] = useState(''); const [city, setCity] = useState(''); const [risk, setRisk] = useState('');
  // money + tax
  const [f, setF] = useState<Record<string, string>>({});
  const F = (k: string) => ({ value: f[k] || '', onChange: (v: string) => setF((x) => ({ ...x, [k]: v })) });
  useEffect(() => {
    if (!me) return;
    setName(me.name || ''); setEmail(me.email || ''); setAge(me.age ? String(me.age) : ''); setEmp(me.employment_type || 'salaried');
    setDeps(String(me.dependents_count ?? 0)); setSt(me.state || ''); setCity(me.city || ''); setRisk(me.risk_appetite || '');
  }, [me]);
  useEffect(() => {
    const p = prof.data; if (!p) return; const a = p.assets || {}, ins = p.insurance || {}, td = p.tax_data || {};
    setF({
      take_home: paiseToRupeesStr(me?.monthly_take_home), expenses: paiseToRupeesStr(a.monthly_expenses), savings: paiseToRupeesStr(a.savings_balance), fd: paiseToRupeesStr(a.fd_total),
      vehicle: paiseToRupeesStr(a.vehicle), epf: paiseToRupeesStr(a.epf), ppf: paiseToRupeesStr(a.ppf), stocks: paiseToRupeesStr(a.stocks), property: paiseToRupeesStr(a.property),
      mf: paiseToRupeesStr(a.mutual_funds?.value), sip: paiseToRupeesStr(a.mutual_funds?.monthly_sip),
      term: paiseToRupeesStr(ins.term?.[0]?.sum_assured), health: paiseToRupeesStr(ins.health?.[0]?.sum_insured),
      epf_80c: paiseToRupeesStr(td.epf_contribution_annual), ppf_80c: paiseToRupeesStr(td.ppf_annual), elss: paiseToRupeesStr(td.elss_annual), nps: paiseToRupeesStr(td.nps_80ccd1b_annual),
      health_prem: paiseToRupeesStr(td.health_premium_self_annual), hl_interest: paiseToRupeesStr(td.home_loan_interest_annual), rent: paiseToRupeesStr(td.rent_paid_monthly), hra: paiseToRupeesStr(td.hra_received_annual),
    });
  }, [prof.data, me?.monthly_take_home]);

  const run = async (fn: () => Promise<any>, ok: string) => { setBusy(true); try { await fn(); await refreshMe(); flash(ok); } catch (e: any) { flash(e.message); } finally { setBusy(false); } };
  const P = (k: string) => rupeesToPaise(f[k] || '0');

  return (
    <Screen onRefresh={() => { prof.reload(); refreshMe(); }} refreshing={prof.refreshing}>
      <Segmented value={tab} onChange={setTab} options={[{ v: 'you', label: 'You' }, { v: 'money', label: 'Money' }, { v: 'tax', label: 'Tax' }, { v: 'work', label: 'Work' }, { v: 'app', label: 'App' }]} />
      {msg ? <Card tone="mint" style={{ marginTop: 12 }}><Small>{msg}</Small></Card> : null}

      {tab === 'you' && <Card style={{ marginTop: SP.lg }}>
        <Input label="Name" value={name} onChangeText={setName} autoComplete="name" />
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!me?.email_verified} hint={me?.email_verified ? 'This is your login email, so it can’t be changed here.' : undefined} />
        <Input label="Age" value={age} onChangeText={(s) => setAge(s.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" />
        <Select label="State" value={st} onChange={(v) => { setSt(v); setCity(''); }} options={STATES.map((s) => ({ v: s, label: s }))} />
        <Select label="City" value={city} onChange={setCity} options={citiesForState(st).map((c) => ({ v: c, label: c }))} />
        <Select label="What do you do?" value={emp} onChange={setEmp} options={[{ v: 'student', label: 'Student' }, { v: 'salaried', label: 'Salaried' }, { v: 'self_employed', label: 'Self-employed' }, { v: 'freelancer', label: 'Freelancer' }, { v: 'business', label: 'Business owner' }, { v: 'both', label: 'Salaried + own a business' }]} />
        <Select label="People who depend on your income" value={deps} onChange={setDeps} options={[0, 1, 2, 3, 4, 5, 6].map((n) => ({ v: String(n), label: String(n) }))} />
        <Select label="Comfort with ups and downs" value={risk} onChange={setRisk} options={[{ v: 'conservative', label: 'Play it safe' }, { v: 'moderate', label: 'Balanced' }, { v: 'aggressive', label: 'Go for growth' }]} />
        <Button title="Save details" loading={busy} onPress={() => run(() => patch('/user/me', {
          ...(name ? { name } : {}), ...(email && !me?.email_verified ? { email } : {}), ...(age && Number(age) >= 18 ? { age: Number(age) } : {}),
          employment_type: emp, dependents_count: Number(deps) || 0, ...(st ? { state: st } : {}), ...(city ? { city } : {}), ...(risk ? { risk_appetite: risk } : {}),
        }), 'Saved — your score has been recalculated.')} />
      </Card>}

      {tab === 'money' && <Card style={{ marginTop: SP.lg }}>
        {prof.loading && !prof.data ? <Loading /> : <>
          <MoneyInput label="Monthly take-home" {...F('take_home')} /><MoneyInput label="Monthly spending" {...F('expenses')} />
          <MoneyInput label="Savings account balance" {...F('savings')} /><MoneyInput label="Fixed deposits" {...F('fd')} />
          <MoneyInput label="Mutual funds — current value" {...F('mf')} /><MoneyInput label="Monthly SIP" {...F('sip')} />
          <MoneyInput label="Stocks — current value" {...F('stocks')} /><MoneyInput label="EPF balance" {...F('epf')} /><MoneyInput label="PPF balance" {...F('ppf')} />
          <MoneyInput label="Property value" {...F('property')} /><MoneyInput label="Vehicle value" {...F('vehicle')} />
          <MoneyInput label="Term life cover" {...F('term')} /><MoneyInput label="Health cover" {...F('health')} />
          <Button title="Save" loading={busy} onPress={() => run(async () => {
            await patch('/user/me', { monthly_take_home: P('take_home') });
            await patch('/user/profile/assets', { monthly_expenses: P('expenses'), savings_balance: P('savings'), fd_total: P('fd'), vehicle: P('vehicle'), epf: P('epf'), ppf: P('ppf'), stocks: P('stocks'), property: P('property'), mutual_funds: { value: P('mf'), monthly_sip: P('sip') } });
            await patch('/user/profile/insurance', { term: P('term') ? [{ sum_assured: P('term') }] : [], health: P('health') ? [{ sum_insured: P('health') }] : [] });
          }, 'Saved — your plan and score are updated.')} />
          <Tiny style={{ marginTop: 8 }}>Loans are best added during onboarding or through Monthly records (loan certificates).</Tiny>
        </>}
      </Card>}

      {tab === 'tax' && <Card style={{ marginTop: SP.lg }}>
        <MoneyInput label="EPF contribution / year (80C)" {...F('epf_80c')} /><MoneyInput label="PPF / year (80C)" {...F('ppf_80c')} /><MoneyInput label="ELSS / year (80C)" {...F('elss')} />
        <MoneyInput label="NPS Tier-1 / year (80CCD-1B)" {...F('nps')} /><MoneyInput label="Health premium / year (80D)" {...F('health_prem')} />
        <MoneyInput label="Home-loan interest / year (24b)" {...F('hl_interest')} /><MoneyInput label="Rent paid / month (HRA)" {...F('rent')} /><MoneyInput label="HRA received / year" {...F('hra')} />
        <Button title="Save tax data" loading={busy} onPress={() => run(() => patch('/user/profile/tax_data', {
          epf_contribution_annual: P('epf_80c'), ppf_annual: P('ppf_80c'), elss_annual: P('elss'), nps_80ccd1b_annual: P('nps'),
          health_premium_self_annual: P('health_prem'), home_loan_interest_annual: P('hl_interest'), rent_paid_monthly: P('rent'), hra_received_annual: P('hra'),
        }), 'Tax data saved.')} />
      </Card>}

      {tab === 'work' && <Work flash={flash} />}

      {tab === 'app' && <AppPrefs lang={lang} setLang={setLang} title={t('set.lang')} me={me} signOut={signOut} flash={flash} />}
    </Screen>
  );
}

function Work({ flash }: { flash: (m: string) => void }) {
  const ctxApi = useApi<any>('/context');
  const sug = useApi<any[]>('/context/suggestions');
  const [ctx, setCtx] = useState<any>({});
  const [ben, setBen] = useState({ type: 'group_health', label: '', base: '', boosted: '', rule: '' });
  useEffect(() => { if (ctxApi.data) setCtx(ctxApi.data); }, [ctxApi.data]);
  return (
    <View style={{ gap: 12, marginTop: SP.lg }}>
      <Card>
        <Small style={{ marginBottom: 10 }}>Your work and the benefits you already have (employer cover, EPF, NPS…) make the guidance smarter — no nagging about cover you already have.</Small>
        <Input label="Occupation" value={ctx.occupation || ''} onChangeText={(v) => setCtx({ ...ctx, occupation: v })} placeholder="e.g. Software engineer" />
        <Input label="Employer" value={ctx.employer || ''} onChangeText={(v) => setCtx({ ...ctx, employer: v })} />
        <Input label="Sector" value={ctx.sector || ''} onChangeText={(v) => setCtx({ ...ctx, sector: v })} placeholder="e.g. IT, Education" />
        <Select label="Employment" value={ctx.employment_nature || ''} onChange={(v) => setCtx({ ...ctx, employment_nature: v })} options={[{ v: 'salaried', label: 'Salaried' }, { v: 'self_employed', label: 'Self-employed' }, { v: 'business', label: 'Business owner' }, { v: 'retired', label: 'Retired' }, { v: 'student', label: 'Student' }]} />
        <Button title="Save work details" onPress={async () => { try { await put('/context', { occupation: ctx.occupation || undefined, employer: ctx.employer || undefined, sector: ctx.sector || undefined, employment_nature: ctx.employment_nature || undefined }); flash('Saved.'); } catch (e: any) { flash(e.message); } }} />
      </Card>
      <Card>
        <Label>Benefits you have</Label>
        {(ctx.benefits || []).length === 0 ? <Small style={{ marginTop: 6 }}>None added yet.</Small> : (ctx.benefits || []).map((b: any) => (
          <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <View style={{ flex: 1 }}><Txt noTr style={{ fontWeight: '600', fontSize: 14 }}>{b.label}</Txt><Tiny noTr>{`${String(b.type).replace(/_/g, ' ')}${b.value_boosted_to || b.value_base ? ` · ${inr(b.value_boosted_to || b.value_base)}` : ''}`}</Tiny></View>
            <Pressable onPress={async () => { try { setCtx(await del(`/context/benefits/${b.id}`)); sug.reload(); } catch {} }}><Small style={{ color: C.red }}>Remove</Small></Pressable>
          </View>
        ))}
      </Card>
      {(sug.data || []).length > 0 && <Card>
        <Label>People like you often have…</Label>
        {(sug.data || []).map((s: any) => (
          <Pressable key={s.key} onPress={() => { const pf = s.prefill || {}; setBen({ type: pf.type || s.type || 'perk', label: pf.label || s.name, base: pf.value_base ? String(Math.round(pf.value_base / 100)) : '', boosted: pf.value_boosted_to ? String(Math.round(pf.value_boosted_to / 100)) : '', rule: '' }); }}
            style={{ borderWidth: 1, borderColor: C.paper200, borderRadius: 12, padding: 10, marginTop: 8 }}>
            <Txt noTr style={{ fontWeight: '600', fontSize: 14 }}>{s.name}</Txt><Small noTr>{s.prompt}</Small>
          </Pressable>
        ))}
      </Card>}
      <Card>
        <Label style={{ marginBottom: 8 }}>Add a benefit</Label>
        <Select label="Type" value={ben.type} onChange={(v) => setBen({ ...ben, type: v })} options={[
          { v: 'group_health', label: 'Employer group health cover' }, { v: 'group_term', label: 'Employer group life cover' }, { v: 'insurance_booster', label: 'Insurance booster (top-up)' },
          { v: 'epf', label: 'EPF / VPF' }, { v: 'nps', label: 'NPS' }, { v: 'gratuity', label: 'Gratuity' }, { v: 'gpf', label: 'GPF (government)' }, { v: 'esops', label: 'ESOPs' },
          { v: 'pension', label: 'Pension' }, { v: 'govt_scheme', label: 'Government scheme' }, { v: 'perk', label: 'Other perk' }]} />
        <Input label="Name" value={ben.label} onChangeText={(v) => setBen({ ...ben, label: v })} placeholder="e.g. Company health cover" />
        <MoneyInput label="Value / cover" value={ben.base} onChange={(v) => setBen({ ...ben, base: v })} />
        <MoneyInput label="Boosted to (if a top-up)" value={ben.boosted} onChange={(v) => setBen({ ...ben, boosted: v })} />
        <Button title="Add benefit" disabled={!ben.label.trim()} onPress={async () => {
          try {
            const body: any = { type: ben.type, label: ben.label.trim(), source: 'employer' };
            if (ben.base) body.value_base = rupeesToPaise(ben.base); if (ben.boosted) body.value_boosted_to = rupeesToPaise(ben.boosted);
            setCtx(await post('/context/benefits', body)); setBen({ type: 'group_health', label: '', base: '', boosted: '', rule: '' }); sug.reload(); flash('Benefit added — your guidance now accounts for it.');
          } catch (e: any) { flash(e.message); }
        }} />
      </Card>
    </View>
  );
}

function AppPrefs({ lang, setLang, title, me, signOut, flash }: any) {
  const [bio, setBio] = useState(false);
  const [bioAvail, setBioAvail] = useState(false);
  const sub = useApi<any>('/billing/subscription');
  useEffect(() => {
    SecureStore.getItemAsync(BIOLOCK_KEY).then((v) => setBio(v === '1')).catch(() => {});
    LocalAuthentication.hasHardwareAsync().then(async (h) => setBioAvail(h && (await LocalAuthentication.isEnrolledAsync()))).catch(() => {});
  }, []);
  async function toggleBio(v: boolean) {
    if (v) { const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Turn on app lock' }); if (!r.success) return; }
    await SecureStore.setItemAsync(BIOLOCK_KEY, v ? '1' : '0'); setBio(v);
  }
  async function exportData() {
    try { const d = await get('/data/export'); await shareText('paywatch-data-export.json', JSON.stringify(d, null, 2)); } catch (e: any) { flash(e.message); }
  }
  function deleteAccount() {
    Alert.alert('Delete your account?', 'This permanently erases your profile, plans, documents, conversations and everything else. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Continue', style: 'destructive', onPress: () => Alert.alert('Last check', 'Delete everything now?', [
        { text: 'Keep my account', style: 'cancel' },
        { text: 'Delete permanently', style: 'destructive', onPress: async () => { try { await api('/user/me', { method: 'DELETE' }); } catch (e: any) { flash(e.message); return; } await signOut(); } },
      ]) },
    ]);
  }
  return (
    <View style={{ gap: 12, marginTop: SP.lg }}>
      <Card>
        <Label style={{ marginBottom: 8 }}>{title}</Label>
        <Segmented value={lang} onChange={setLang} options={[{ v: 'en', label: 'English' }, { v: 'hi', label: 'हिंदी' }]} />
      </Card>
      <Card>
        <Label style={{ marginBottom: 4 }}>Security</Label>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
          <Icon name="finger-print" color={C.pine700} />
          <View style={{ flex: 1 }}><Txt style={{ fontWeight: '600' }}>App lock</Txt><Tiny>{bioAvail ? 'Ask for Face ID / fingerprint when opening PayWatch.' : 'Set up Face ID, fingerprint or a passcode on this phone to use app lock.'}</Tiny></View>
          <Switch value={bio} onValueChange={toggleBio} disabled={!bioAvail} trackColor={{ true: C.mint500 }} accessibilityLabel="App lock" />
        </View>
      </Card>
      <Card>
        <Label style={{ marginBottom: 4 }}>Your plan</Label>
        <Txt noTr style={{ fontWeight: '700', textTransform: 'capitalize' }}>{`${me?.plan || 'free'}${me?.plan_status === 'active' ? ' · active' : ''}`}</Txt>
        <Small style={{ marginTop: 4 }}>Plan changes aren’t available in the app.</Small>
        {(sub.data?.invoices || []).length > 0 && <Small noTr style={{ marginTop: 6 }}>{`${sub.data.invoices.length} GST invoice(s) on your account.`}</Small>}
      </Card>
      <Card style={{ paddingVertical: 4 }}>
        <Row icon="download-outline" title="Export my data" subtitle="Everything we hold about you, as a JSON file." onPress={exportData} />
        <Row icon="shield-outline" title="Privacy policy" onPress={() => Linking.openURL(`${WEB_URL}/legal/privacy`)} />
        <Row icon="document-text-outline" title="Terms" onPress={() => Linking.openURL(`${WEB_URL}/legal/terms`)} />
        <Row icon="mail-outline" title="Contact & grievance" subtitle="grievance@paywatch.in" onPress={() => Linking.openURL('mailto:grievance@paywatch.in')} last />
      </Card>
      <Button kind="secondary" title="Sign out" icon="log-out-outline" onPress={signOut} />
      <Button kind="danger" title="Delete my account" icon="trash-outline" onPress={deleteAccount} />
      <Disclaimer>PayWatch is a financial education, organisation and tax-preparation tool. It is not a SEBI-registered investment adviser, an insurer or a Chartered Accountant.</Disclaimer>
    </View>
  );
}
