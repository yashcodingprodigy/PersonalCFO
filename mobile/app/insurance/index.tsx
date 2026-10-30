// Insurance — your cover vs standard benchmarks, your uploaded policies (AI-read, renewal alerts),
// a quick needs check, what to get in order, and what to avoid. Category guidance only.
import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useApi } from '@/lib/hooks';
import { ask, del, post } from '@/lib/api';
import { inr, inrRange, prettyDate, rupeesToPaise, paiseToRupeesStr } from '@/lib/format';
import { pickFile, parseOnServer, TYPES, openProtectedFile } from '@/lib/files';
import { C, FONT, R, SP } from '@/lib/theme';
import { Bullets, Button, Card, Chip, Disclaimer, Disclosure, ErrorBox, Input, Label, Loading, MoneyInput, Num, Ring, Screen, Section, Segmented, Select, Sheet, Small, Soft, Tiny, Txt, H3 } from '@/components/ui';

const CATS = [
  { key: 'term_life', label: 'Term life' }, { key: 'health', label: 'Health' }, { key: 'motor', label: 'Motor (car / bike)' },
  { key: 'personal_accident', label: 'Personal accident' }, { key: 'critical_illness', label: 'Critical illness' }, { key: 'home', label: 'Home / property' },
  { key: 'travel', label: 'Travel' }, { key: 'life_endowment', label: 'Endowment / ULIP' }, { key: 'other', label: 'Other' },
];
const catLabel = (k: string) => CATS.find((c) => c.key === k)?.label || k;
const PRIORITY: Record<string, { label: string; bg: string; fg: string }> = {
  high: { label: 'Get this first', bg: '#F8E3DF', fg: C.red }, medium: { label: 'Worth getting', bg: '#FBF0DF', fg: C.amber }, low: { label: 'Optional', bg: C.paper100, fg: C.inkSoft },
};
const NEEDS = [
  { key: 'dependents', q: 'Does anyone rely on your income — family, kids or parents?', when: 'yes', cover: 'term_life', label: 'Term life cover', why: 'Replaces your income for the people who depend on you.' },
  { key: 'ownhealth', q: 'Do you have your own health insurance (not just from work)?', when: 'no', cover: 'health', label: 'Health cover', why: 'Employer cover ends with the job. Your own policy stays with you.' },
  { key: 'vehicle', q: 'Do you own a car or bike?', when: 'yes', cover: 'motor', label: 'Motor insurance', why: 'Legally required; covers damage, theft and third-party claims.' },
  { key: 'earner', q: 'Would an accident that stopped you working hurt your family financially?', when: 'yes', cover: 'personal_accident', label: 'Personal accident cover', why: 'Pays out if an accident stops you earning — inexpensive and often missed.' },
];
const daysTo = (s?: string | null) => (s ? Math.round((new Date(s).getTime() - Date.now()) / 86400000) : null);
const iso = (s: any) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '');

export default function Insurance() {
  const ins = useApi<any>('/insurance');
  const d = ins.data;
  if (ins.loading && !d) return <Screen><Loading /></Screen>;
  if (!d) return <Screen><ErrorBox message={ins.error || 'Could not load'} onRetry={ins.reload} /></Screen>;
  return (
    <Screen onRefresh={ins.reload} refreshing={ins.refreshing}>
      <Soft>Measured against standard planning benchmarks — category guidance only, never a specific product.</Soft>
      {d.beginnerIntro ? <Card tone="mint" style={{ marginTop: SP.lg }}><Small>{d.beginnerIntro}</Small></Card> : null}
      {d.flags?.length > 0 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SP.md }}>{d.flags.map((f: any, i: number) => <Chip key={i} label={f.message} bg={PRIORITY[f.severity]?.bg || C.paper100} color={PRIORITY[f.severity]?.fg || C.inkSoft} />)}</View>}

      <Card tone="dark" style={{ marginTop: SP.lg }} onPress={() => router.push('/insurance/market')}>
        <Txt style={{ color: C.mint300, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 }}>FIND & COMPARE</Txt>
        <Txt style={{ color: C.white, fontFamily: FONT.display, fontSize: 21, marginTop: 4 }}>See plans for you</Txt>
        <Small style={{ color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>Compare real plans and start an application — arranged through our IRDAI-licensed insurance partner.</Small>
        <Txt style={{ color: C.mint300, fontWeight: '700', marginTop: 10 }}>See plans →</Txt>
      </Card>

      <Section title="Your coverage">
        <View style={{ gap: 12 }}>
          <Coverage title="Term life cover" c={d.term} extra={d.term.premiumEstimateAnnual ? `Closing the gap: ~${inr(d.term.premiumEstimateAnnual.low)}–${inr(d.term.premiumEstimateAnnual.high)}/yr` : ''} />
          <Coverage title="Health cover" c={d.health} />
        </View>
      </Section>

      <Section title="My policies" sub="Upload a policy PDF — I read the cover, premium and dates, and remind you before renewal."><Policies /></Section>

      <Section title="What cover you may need" sub="A quick check — general guidance, not advice."><NeedsCheck /></Section>

      {d.recommendations?.length > 0 && (
        <Section title="What to get — in order">
          <View style={{ gap: 10 }}>
            {d.recommendations.map((r: any, i: number) => (
              <Disclosure key={i} title={r.title} subtitle={r.estCostAnnual ? `~${inr(r.estCostAnnual.low)}–${inr(r.estCostAnnual.high)}/yr` : undefined}
                left={<Chip label={PRIORITY[r.priority]?.label || r.priority} bg={PRIORITY[r.priority]?.bg} color={PRIORITY[r.priority]?.fg} />}>
                <Small>{r.whatItIs}</Small>
                <Small style={{ color: C.pine800, marginTop: 8 }}>{`Why you: ${r.whyForYou}`}</Small>
                <Small style={{ marginTop: 6 }}>{`How: ${r.howTo}`}</Small>
              </Disclosure>
            ))}
          </View>
        </Section>
      )}
      {d.avoid?.length > 0 && <Section title="What to avoid"><Card style={{ borderLeftWidth: 4, borderLeftColor: C.amber }}><Bullets items={d.avoid} mark="✕" color={C.amber} /></Card></Section>}
      <Section title="Good to know"><Card><Bullets items={[...(d.term.notes || []), ...(d.health.notes || [])]} /></Card></Section>
      <Disclaimer>{d.disclaimer || 'Educational guidance only. Not insurance advice.'}</Disclaimer>
    </Screen>
  );
}

function Coverage({ title, c, extra }: { title: string; c: any; extra?: string }) {
  const covered = c.recommended > 0 ? Math.min(1, c.current / c.recommended) : 1;
  const color = covered >= 1 ? C.green : covered >= 0.5 ? C.amber : C.red;
  return (
    <Card style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
      <Ring value={covered} size={88} stroke={9} color={color}><Num style={{ fontFamily: FONT.display, fontSize: 18 }}>{Math.round(covered * 100)}%</Num><Tiny>covered</Tiny></Ring>
      <View style={{ flex: 1 }}>
        <Label>{title}</Label>
        <Num style={{ fontFamily: FONT.display, fontSize: 22, marginTop: 2 }}>{inr(c.current)}</Num>
        <Tiny noTr>{`target ${c.recommended > 0 ? inrRange(c.recommended) : '—'}`}</Tiny>
        {c.recommended > 0 && c.gap > 0 ? <Small noTr style={{ color: C.red, fontWeight: '700', marginTop: 4 }}>{`Gap: ${inrRange(c.gap)}`}</Small>
          : <Small style={{ color: C.green, fontWeight: '700', marginTop: 4 }}>{c.recommended === 0 ? 'Not needed yet' : 'Fully covered'}</Small>}
        {extra ? <Tiny noTr style={{ marginTop: 4 }}>{extra}</Tiny> : null}
      </View>
    </Card>
  );
}

function NeedsCheck() {
  const [ans, setAns] = useState<Record<string, string>>({});
  const done = NEEDS.every((q) => ans[q.key]);
  const needs = NEEDS.filter((q) => ans[q.key] === q.when);
  return (
    <Card style={{ gap: 14 }}>
      {NEEDS.map((q, i) => (
        <View key={q.key} style={{ gap: 8 }}>
          <Txt style={{ fontSize: 15 }}>{`${i + 1}. ${q.q}`}</Txt>
          <Segmented value={ans[q.key] || ''} onChange={(v: string) => setAns((a) => ({ ...a, [q.key]: v }))} options={[{ v: 'yes', label: 'Yes' }, { v: 'no', label: 'No' }]} />
        </View>
      ))}
      {done && (needs.length ? (
        <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: C.paper100, paddingTop: 12 }}>
          <Txt style={{ fontWeight: '700' }}>Based on your answers, you may want to look at:</Txt>
          {needs.map((n) => (
            <Card key={n.key} tone="paper" onPress={() => router.push({ pathname: '/insurance/market', params: { category: n.cover } } as any)}>
              <Txt style={{ fontWeight: '700' }}>{n.label}</Txt><Small>{n.why}</Small>
              <Txt style={{ color: C.pine700, fontWeight: '700', marginTop: 6 }}>See plans →</Txt>
            </Card>
          ))}
        </View>
      ) : <Small style={{ color: C.green }}>Looks like the basics are covered. 👍</Small>)}
    </Card>
  );
}

function Policies() {
  const pol = useApi<any[]>('/insurance/policies');
  const apps = useApi<any[]>('/insurance/applications');
  const [cat, setCat] = useState('health');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [st, setSt] = useState<any>(null); // staged
  const [saving, setSaving] = useState(false);
  const up = (p: any) => setSt((s: any) => ({ ...s, ...p }));

  async function upload() {
    setErr('');
    try {
      const f = await pickFile(TYPES.pdf);
      if (!f) return;
      setBusy(true);
      const { text } = await parseOnServer<{ text: string; readable: boolean }>(f, 'text');
      const base = { category: cat, file: f };
      if (!text || text.replace(/\s/g, '').length < 60) { setSt({ ...base, invalid: true, reason: 'This file has almost no readable text — it looks like a scan or photo. Upload a clearer PDF, or fill in the details by hand.' }); return; }
      const ai: any = await ask('/insurance/ai-extract', { category: cat, text }, 60000).catch(() => null);
      if (ai?.available && ai.result) {
        const x = ai.result.fields || {};
        setSt({ ...base, summary: ai.result.summary, insurer: x.insurer || '', plan_name: x.planName || '', policy_number: x.policyNumber || '',
          sum: x.sumAssured ? String(Math.round(Number(x.sumAssured))) : '', premium: x.premium ? String(Math.round(Number(x.premium))) : '', premium_frequency: x.premiumFrequency || '',
          issue_date: iso(x.issueDate), start_date: iso(x.startDate), expiry_date: iso(x.expiryDate), maturity_date: iso(x.maturityDate), renewal_date: iso(x.renewalDate), extracted: x,
          invalid: ai.result.matchesExpected === false || ai.result.readable === false, reason: ai.result.reason, detected: ai.result.documentType });
      } else setSt({ ...base, summary: 'The AI reader is busy — fill in the details below and save.' });
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  async function save() {
    setSaving(true); setErr('');
    try {
      const rec: any = await post('/insurance/policies', {
        category: st.category, insurer: st.insurer || null, plan_name: st.plan_name || null, policy_number: st.policy_number || null,
        sum_assured: st.sum ? rupeesToPaise(st.sum) : null, premium: st.premium ? rupeesToPaise(st.premium) : null, premium_frequency: st.premium_frequency || null,
        issue_date: iso(st.issue_date) || null, start_date: iso(st.start_date) || null, expiry_date: iso(st.expiry_date) || null,
        maturity_date: iso(st.maturity_date) || null, renewal_date: iso(st.renewal_date) || null, extracted: st.extracted || {},
      });
      await post(`/insurance/policies/${rec.policy_id}/file`, { file_name: st.file.name, mime_type: st.file.mime, data: st.file.base64 }).catch(() => {});
      setSt(null);
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }
  const remove = (p: any) => Alert.alert('Remove this policy?', 'Your cover and score will be updated.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => del(`/insurance/policies/${p.policy_id}`).catch((e) => setErr(e.message)) }]);

  return (
    <View style={{ gap: 10 }}>
      <Card>
        <Select label="Policy type" value={cat} onChange={setCat} options={CATS.map((c) => ({ v: c.key, label: c.label }))} />
        <Button title="Upload policy PDF" icon="cloud-upload-outline" onPress={upload} loading={busy} />
        {err ? <Small style={{ color: C.red, marginTop: 8 }}>{err}</Small> : null}
      </Card>
      {(pol.data || []).map((p: any) => {
        const renew = p.renewal_date || p.expiry_date; const dd = daysTo(renew); const md = daysTo(p.maturity_date);
        const badge = dd != null && dd < 0 ? { l: `Lapsed ${prettyDate(renew)}`, bg: '#F8E3DF', fg: C.red } : dd != null && dd <= 30 ? { l: `Renew in ${dd}d`, bg: '#FBF0DF', fg: C.amber }
          : md != null && md >= 0 && md <= 60 ? { l: `Matures in ${md}d`, bg: C.pine900, fg: C.white } : { l: 'Active', bg: C.mint100, fg: C.pine800 };
        return (
          <Card key={p.policy_id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1 }}><H3 noTr>{p.insurer || catLabel(p.category)}</H3><Tiny noTr>{[catLabel(p.category), p.plan_name].filter(Boolean).join(' · ')}</Tiny></View>
              <Chip noTr label={badge.l} bg={badge.bg} color={badge.fg} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, rowGap: 6 }}>
              {[['Cover', p.sum_assured ? inr(p.sum_assured) : '—'], ['Premium', p.premium ? `${inr(p.premium)}${p.premium_frequency ? ` / ${p.premium_frequency}` : ''}` : '—'], ['Renews / expires', prettyDate(renew)], ['Matures', prettyDate(p.maturity_date)]].map(([k, v]) => (
                <View key={k} style={{ width: '50%' }}><Tiny>{k}</Tiny><Num style={{ fontWeight: '600', fontSize: 14 }}>{v}</Num></View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 10 }}>
              {p.has_file && <Pressable onPress={() => openProtectedFile(`/insurance/policies/${p.policy_id}/file`, p.file_name || 'policy.pdf').catch((e) => setErr(e.message))}><Txt style={{ color: C.pine700, fontWeight: '700', fontSize: 14 }}>Open file</Txt></Pressable>}
              <Pressable onPress={() => remove(p)}><Txt style={{ color: C.inkFaint, fontSize: 14, textDecorationLine: 'underline' }}>Remove</Txt></Pressable>
            </View>
          </Card>
        );
      })}
      {(apps.data || []).length > 0 && (
        <Card tone="paper">
          <Label>Your applications</Label>
          {(apps.data || []).map((a: any) => (
            <View key={a.application_id || a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1 }}><Txt noTr style={{ fontWeight: '600', fontSize: 14 }}>{`${a.insurer || ''} ${a.plan_name || ''}`.trim() || catLabel(a.category)}</Txt><Tiny>Submitted — issuance through our licensed partner activating soon</Tiny></View>
              <Pressable onPress={() => del(`/insurance/applications/${a.application_id || a.id}`)}><Small style={{ textDecorationLine: 'underline' }}>Withdraw</Small></Pressable>
            </View>
          ))}
        </Card>
      )}

      <Sheet visible={!!st} onClose={() => setSt(null)} title="Check the details" full>
        {st && <>
          {st.invalid ? <Card style={{ backgroundColor: '#FBF0DF', marginBottom: SP.md }}><Small style={{ color: C.amber }}>{st.reason || `This doesn’t look like a ${catLabel(st.category)} policy${st.detected ? ` (looks like: ${st.detected})` : ''}. Please check it’s the right file.`}</Small></Card>
            : st.summary ? <Card tone="mint" style={{ marginBottom: SP.md }}><Small>{st.summary}</Small></Card> : null}
          <Select label="Policy type" value={st.category} onChange={(v) => up({ category: v })} options={CATS.map((c) => ({ v: c.key, label: c.label }))} />
          <Input label="Insurer" value={st.insurer || ''} onChangeText={(v) => up({ insurer: v })} />
          <Input label="Plan name" value={st.plan_name || ''} onChangeText={(v) => up({ plan_name: v })} />
          <Input label="Policy number" value={st.policy_number || ''} onChangeText={(v) => up({ policy_number: v })} />
          <MoneyInput label="Cover / sum assured" value={st.sum || ''} onChange={(v) => up({ sum: v })} />
          <MoneyInput label="Premium" value={st.premium || ''} onChange={(v) => up({ premium: v })} />
          <Input label="Premium frequency" value={st.premium_frequency || ''} onChangeText={(v) => up({ premium_frequency: v })} placeholder="yearly / monthly" />
          {(['start_date', 'expiry_date', 'renewal_date', 'maturity_date'] as const).map((k) => (
            <Input key={k} label={{ start_date: 'Start date', expiry_date: 'Expiry date', renewal_date: 'Renewal date', maturity_date: 'Maturity date' }[k]}
              value={st[k] || ''} onChangeText={(v) => up({ [k]: v })} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
          ))}
          <Button title="Save policy" onPress={save} loading={saving} />
          <Tiny style={{ marginTop: 8 }}>Your file is stored encrypted. Dates power your renewal reminders.</Tiny>
        </>}
      </Sheet>
    </View>
  );
}
