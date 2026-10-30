// Three short steps. Only take-home is required; everything else can be filled later.
import React, { useState } from 'react';
import { Pressable, View, Linking } from 'react-native';
import { patch, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { inr, rupeesToPaise } from '@/lib/format';
import { STATES, citiesForState } from '@/lib/india';
import { C, R, SP } from '@/lib/theme';
import { Bar, Button, Card, Check, H1, Input, Label, MoneyInput, Screen, Select, Small, Soft, Tiny, Txt, Gap } from '@/components/ui';
import { WEB_URL } from '@/lib/api';

const BAND: Record<string, number> = { '5-10': 75000000, '10-20': 150000000, '20-35': 275000000, '35+': 450000000 };

export default function Onboarding() {
  const { refreshMe, me } = useAuth();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [learned, setLearned] = useState('');

  const [name, setName] = useState(me?.name || '');
  const [age, setAge] = useState('');
  const [st, setSt] = useState('');
  const [city, setCity] = useState('');
  const [emp, setEmp] = useState('salaried');
  const [band, setBand] = useState('10-20');
  const [takeHome, setTakeHome] = useState('');
  const [expenses, setExpenses] = useState('');
  const [deps, setDeps] = useState('0');
  const [consent, setConsent] = useState(false);
  const [guardian, setGuardian] = useState('');
  const [guardianOk, setGuardianOk] = useState(false);

  const [savings, setSavings] = useState(''); const [fd, setFd] = useState(''); const [mf, setMf] = useState(''); const [sip, setSip] = useState('');
  const [epf, setEpf] = useState(''); const [ppf, setPpf] = useState(''); const [stocks, setStocks] = useState(''); const [property, setProperty] = useState('');
  const [risk, setRisk] = useState('');

  const [hlOut, setHlOut] = useState(''); const [hlEmi, setHlEmi] = useState(''); const [plOut, setPlOut] = useState(''); const [plEmi, setPlEmi] = useState('');
  const [ccOut, setCcOut] = useState(''); const [ccLimit, setCcLimit] = useState(''); const [term, setTerm] = useState(''); const [health, setHealth] = useState('');

  const student = emp === 'student';
  const minor = age !== '' && Number(age) < 18;

  async function s1() {
    setBusy(true); setErr('');
    try {
      const gross = student ? rupeesToPaise(takeHome || '0') * 12 : BAND[band];
      await patch('/user/me', {
        name: name || undefined, city: city || undefined, state: st || undefined,
        ...(age && Number(age) >= 18 ? { age: Number(age) } : {}),
        employment_type: emp, annual_gross_income: gross, monthly_take_home: rupeesToPaise(takeHome), dependents_count: Number(deps),
        onboarding_status: { session_1: 'complete', session_2: 'pending', session_3: 'pending' },
      });
      await post('/consents', { consent_type: 'data_processing', granted: true, meta: { at: 'onboarding', platform: 'app' } }).catch(() => {});
      if (minor) await post('/consents', { consent_type: 'parental_consent', granted: true, meta: { guardian } }).catch(() => {});
      if (expenses) await patch('/user/profile/assets', { monthly_expenses: rupeesToPaise(expenses) });
      const save = expenses && Number(takeHome) > 0 ? Math.round(((Number(takeHome) - Number(expenses)) / Number(takeHome)) * 100) : null;
      setLearned(save != null
        ? `You save roughly ${save}% of what comes in each month. ${save >= 25 ? 'That’s already past the 25% benchmark — strong start.' : '25% is your first target.'}`
        : 'Your income is set. Add spending later to unlock your savings rate.');
      setStep(2);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  async function s2(skip = false) {
    setBusy(true); setErr('');
    try {
      if (!skip) {
        const a: any = {};
        if (savings) a.savings_balance = rupeesToPaise(savings);
        if (fd) a.fd_total = rupeesToPaise(fd);
        if (mf || sip) a.mutual_funds = { value: rupeesToPaise(mf || '0'), monthly_sip: rupeesToPaise(sip || '0') };
        if (epf) a.epf = rupeesToPaise(epf);
        if (ppf) a.ppf = rupeesToPaise(ppf);
        if (stocks) a.stocks = rupeesToPaise(stocks);
        if (property) a.property = rupeesToPaise(property);
        if (Object.keys(a).length) await patch('/user/profile/assets', a);
      }
      await patch('/user/me', { ...(risk && !skip ? { risk_appetite: risk } : {}), onboarding_status: { session_1: 'complete', session_2: skip ? 'deferred' : 'complete', session_3: 'pending' } });
      const total = [savings, fd, mf, epf, ppf, stocks, property].reduce((s, v) => s + (Number(v) || 0), 0);
      setLearned(skip ? '' : total > 0 ? `Your assets add up to about ${inr(total * 100)}. Net worth and diversification are now live.` : 'Starting from zero is fine — your plan begins with the foundations.');
      setStep(3);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  async function s3(skip = false) {
    setBusy(true); setErr('');
    try {
      if (!skip) {
        const l: any = {};
        if (hlOut) l.home_loans = [{ outstanding: rupeesToPaise(hlOut), emi: rupeesToPaise(hlEmi || '0'), rate: 8.5 }];
        if (plOut) l.personal_loans = [{ outstanding: rupeesToPaise(plOut), emi: rupeesToPaise(plEmi || '0'), rate: 13 }];
        if (ccOut || ccLimit) l.credit_cards = [{ outstanding: rupeesToPaise(ccOut || '0'), limit: rupeesToPaise(ccLimit || '0') }];
        if (Object.keys(l).length) await patch('/user/profile/liabilities', l);
        const ins: any = {};
        if (term) ins.term = [{ sum_assured: rupeesToPaise(term) }];
        if (health) ins.health = [{ sum_insured: rupeesToPaise(health) }];
        if (Object.keys(ins).length) await patch('/user/profile/insurance', ins);
      }
      await patch('/user/me', { onboarding_status: { session_1: 'complete', session_2: 'complete', session_3: skip ? 'deferred' : 'complete' } });
      await post('/score/recalculate').catch(() => {});
      await refreshMe(); // flips the gate into the app
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }

  const pct = step === 1 ? 0.08 : step === 2 ? 0.4 : 0.75;
  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Label>Step {step} of 3</Label><Tiny>{Math.round(pct * 100)}%</Tiny>
      </View>
      <Bar value={pct} />
      <Gap h={SP.lg} />
      {learned ? <Card tone="mint" style={{ marginBottom: SP.lg }}><Label style={{ color: C.pine700 }}>What we learned</Label><Soft style={{ marginTop: 4 }}>{learned}</Soft></Card> : null}

      {step === 1 && (
        <Card>
          <H1 style={{ fontSize: 26 }}>About you & your money</H1>
          <Soft style={{ marginTop: 4, marginBottom: SP.lg }}>About 3 minutes. Only take-home is needed — the rest makes your plan sharper.</Soft>
          <Input label="Your name" value={name} onChangeText={setName} placeholder="Name" autoComplete="name" textContentType="name" />
          <Input label="Age" value={age} onChangeText={(s) => setAge(s.replace(/\D/g, '').slice(0, 2))} placeholder="24" keyboardType="number-pad" />
          <Select label="State" value={st} onChange={(v) => { setSt(v); setCity(''); }} options={STATES.map((s) => ({ v: s, label: s }))} placeholder="Select your state…" />
          <Select label="City" value={city} onChange={setCity} options={citiesForState(st).map((c) => ({ v: c, label: c }))} placeholder={st ? 'Select your city…' : 'Pick a state first'} hint="Used for HRA and cost of living." />
          <Select label="What do you do?" value={emp} onChange={setEmp} options={[
            { v: 'student', label: 'Student' }, { v: 'salaried', label: 'Salaried' }, { v: 'self_employed', label: 'Self-employed' },
            { v: 'freelancer', label: 'Freelancer' }, { v: 'business', label: 'Business owner' }, { v: 'both', label: 'Salaried + own a business' },
          ]} />
          {student ? (
            <Card tone="mint" style={{ marginBottom: SP.lg }}><Small style={{ color: C.pine800 }}>Welcome 👋 No big salary or insurance yet? That’s fine — we start with the basics: saving a little and investing early.</Small></Card>
          ) : (
            <View style={{ marginBottom: SP.lg }}>
              <Txt style={{ fontSize: 14, fontWeight: '600', color: C.inkSoft, marginBottom: 6 }}>Yearly income (before tax)</Txt>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {Object.keys(BAND).map((b) => (
                  <Pressable key={b} onPress={() => setBand(b)} accessibilityRole="radio" accessibilityState={{ selected: band === b }}
                    style={{ flex: 1, minHeight: 44, borderRadius: R.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center', borderColor: band === b ? C.pine900 : C.paper200, backgroundColor: band === b ? C.pine900 : C.white }}>
                    <Txt noTr style={{ fontSize: 13, fontWeight: '700', color: band === b ? C.white : C.ink }}>₹{b}L</Txt>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          <MoneyInput label={student ? 'Money you get each month *' : 'Monthly take-home (after tax & PF) *'} value={takeHome} onChange={setTakeHome}
            placeholder={student ? '8,000' : '85,000'} hint={student ? 'Allowance, stipend, part-time — a rough total is fine.' : 'What actually lands in your account.'} />
          <MoneyInput label={student ? 'Roughly what you spend a month' : 'Monthly spending (approx.)'} value={expenses} onChange={setExpenses} hint="Unlocks your savings rate — an estimate is fine." />
          <Select label="People who depend on your income" value={deps} onChange={setDeps} options={[0, 1, 2, 3, 4, 5].map((n) => ({ v: String(n), label: String(n) }))} />
          {minor && (
            <Card tone="paper" style={{ marginBottom: SP.lg }}>
              <Small>You’re under 18, so a parent or guardian needs to consent to this account.</Small>
              <Gap h={8} />
              <Input label="Parent / guardian name" value={guardian} onChangeText={setGuardian} />
              <Check checked={guardianOk} onChange={setGuardianOk}><Small>I am the parent/guardian and I consent to PayWatch processing this minor’s data.</Small></Check>
            </Card>
          )}
          <Check checked={consent} onChange={setConsent}>
            <Small>I consent to PayWatch securely processing the financial details I enter to build my plan, score and tax documents. I can export or delete my data anytime in Settings.{' '}
              <Txt style={{ color: C.pine700, textDecorationLine: 'underline', fontSize: 13 }} onPress={() => Linking.openURL(`${WEB_URL}/legal/privacy`)}>Privacy Policy</Txt></Small>
          </Check>
          {err ? <Small style={{ color: C.red, marginTop: 8 }}>{err}</Small> : null}
          <Gap h={SP.md} />
          <Button title="Continue" onPress={s1} loading={busy} disabled={!takeHome || !consent || (minor && (!guardian || !guardianOk))} />
        </Card>
      )}

      {step === 2 && (
        <Card>
          <H1 style={{ fontSize: 26 }}>Savings & investments</H1>
          <Soft style={{ marginTop: 4, marginBottom: SP.lg }}>All optional. Use today’s value (what it’s worth now), not what you put in.</Soft>
          <MoneyInput label="Savings account balance" value={savings} onChange={setSavings} hint="Used for your safety-net check." />
          <MoneyInput label="Fixed deposits (total)" value={fd} onChange={setFd} />
          <MoneyInput label="Mutual funds — current value" value={mf} onChange={setMf} />
          <MoneyInput label="Monthly SIP" value={sip} onChange={setSip} />
          <MoneyInput label="EPF balance" value={epf} onChange={setEpf} />
          <MoneyInput label="PPF balance" value={ppf} onChange={setPpf} />
          <MoneyInput label="Stocks — current value" value={stocks} onChange={setStocks} />
          <MoneyInput label="Property value (if owned)" value={property} onChange={setProperty} />
          <Txt style={{ fontSize: 14, fontWeight: '600', color: C.inkSoft, marginBottom: 6 }}>How do you feel about ups and downs?</Txt>
          {[{ k: 'conservative', t: 'Play it safe', d: 'A drop would worry me' }, { k: 'moderate', t: 'Balanced', d: 'Some ups & downs are fine' }, { k: 'aggressive', t: 'Go for growth', d: 'I can ride out big swings' }].map((r) => (
            <Pressable key={r.k} onPress={() => setRisk(r.k)} accessibilityRole="radio" accessibilityState={{ selected: risk === r.k }}
              style={{ borderWidth: 1.5, borderColor: risk === r.k ? C.pine700 : C.paper200, backgroundColor: risk === r.k ? C.mint100 : C.white, borderRadius: R.md, padding: 12, marginBottom: 8 }}>
              <Txt style={{ fontWeight: '700' }}>{r.t}</Txt><Small>{r.d}</Small>
            </Pressable>
          ))}
          {err ? <Small style={{ color: C.red, marginTop: 8 }}>{err}</Small> : null}
          <Gap h={SP.md} />
          <Button title="Continue" onPress={() => s2(false)} loading={busy} />
          <Button kind="ghost" title="Fill later" onPress={() => s2(true)} style={{ marginTop: 6 }} />
        </Card>
      )}

      {step === 3 && (
        <Card>
          <H1 style={{ fontSize: 26 }}>Loans & insurance</H1>
          <Soft style={{ marginTop: 4, marginBottom: SP.lg }}>{student ? 'Most students have none of these — tap “Fill later”. It won’t hurt your score.' : 'Last step — unlocks your full Money Health Score.'}</Soft>
          <MoneyInput label="Home loan outstanding" value={hlOut} onChange={setHlOut} />
          <MoneyInput label="Home loan EMI / month" value={hlEmi} onChange={setHlEmi} />
          <MoneyInput label="Personal / car loan outstanding" value={plOut} onChange={setPlOut} />
          <MoneyInput label="Its EMI / month" value={plEmi} onChange={setPlEmi} />
          <MoneyInput label="Credit card outstanding" value={ccOut} onChange={setCcOut} />
          <MoneyInput label="Total credit card limit" value={ccLimit} onChange={setCcLimit} />
          <MoneyInput label="Term life cover (sum assured)" value={term} onChange={setTerm} hint="Pure term plans only." />
          <MoneyInput label="Health cover (sum insured)" value={health} onChange={setHealth} hint="Include employer cover." />
          {err ? <Small style={{ color: C.red, marginTop: 8 }}>{err}</Small> : null}
          <Gap h={SP.md} />
          <Button title="Show my plan" onPress={() => s3(false)} loading={busy} />
          <Button kind="ghost" title="Fill later" onPress={() => s3(true)} style={{ marginTop: 6 }} />
        </Card>
      )}
    </Screen>
  );
}
