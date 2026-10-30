// Action plan — every step ranked by impact. Mark done (optionally: how much, into what) → profile + score update.
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useApi } from '@/lib/hooks';
import { patch, post } from '@/lib/api';
import { prettyDate, rupeesToPaise } from '@/lib/format';
import { C, FONT, SP } from '@/lib/theme';
import { Button, Card, Chip, Empty, ErrorBox, Label, Loading, MoneyInput, Num, Screen, Segmented, Select, Small, Soft, Txt, Icon, Gap } from '@/components/ui';
import { ScoreCard } from '@/components/brain';

const TYPES: Record<string, { v: string; label: string }[]> = {
  investment: [{ v: 'index_fund', label: 'Index fund' }, { v: 'mutual_fund', label: 'Mutual fund' }, { v: 'stocks', label: 'Stocks' }, { v: 'nps', label: 'NPS' }, { v: 'ppf', label: 'PPF' }, { v: 'gold', label: 'Gold (SGB / ETF)' }, { v: 'fd', label: 'Fixed deposit' }],
  savings: [{ v: 'savings', label: 'Savings account' }, { v: 'fd', label: 'Fixed deposit' }],
  insurance: [{ v: 'term_insurance', label: 'Term life cover (sum assured)' }, { v: 'health_insurance', label: 'Health cover (sum insured)' }],
};
const PRI: Record<string, { label: string; bg: string; fg: string }> = { high: { label: 'High priority', bg: '#F8E3DF', fg: C.red }, medium: { label: 'Medium', bg: '#FBF0DF', fg: C.amber }, low: { label: 'Low', bg: C.paper100, fg: C.inkSoft } };
const RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export default function Actions() {
  const list = useApi<any>('/actions');
  const stats = useApi<any>('/actions/stats/summary');
  const score = useApi<any>('/score');
  const [status, setStatus] = useState<'open' | 'done' | 'all'>('open');
  const [pri, setPri] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; step: 'ask' | 'details' } | null>(null);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const all: any[] = Array.isArray(list.data) ? list.data : list.data?.actions || [];
  let visible = all.filter((a) => status === 'all' ? true : status === 'done' ? a.status === 'done' : ['pending', 'in_progress', 'deferred'].includes(a.status));
  if (pri !== 'all') visible = visible.filter((a) => (a.priority || 'medium') === pri);
  visible = [...visible].sort((a, b) => (RANK[a.priority || 'medium'] - RANK[b.priority || 'medium']) || (b.impact_score - a.impact_score));

  async function complete(a: any, body: any) {
    setBusy(true);
    try { await post(`/actions/${a.action_id}/complete`, body); setConfirm(null); setMsg('Done — your profile and score are updated.'); setTimeout(() => setMsg(''), 3500); }
    catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }

  return (
    <Screen onRefresh={() => { list.reload(); stats.reload(); score.reload(); }} refreshing={list.refreshing}>
      {score.data && <Card><ScoreCard score={score.data} /></Card>}
      {stats.data && (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Card style={{ flex: 1 }}><Num style={{ fontFamily: FONT.display, fontSize: 24 }}>{stats.data.done_this_month ?? 0}</Num><Small>done this month</Small></Card>
          <Card style={{ flex: 1 }}><Num style={{ fontFamily: FONT.display, fontSize: 24 }}>{stats.data.open ?? 0}</Num><Small>open</Small></Card>
        </View>
      )}
      <Gap h={SP.lg} />
      <Segmented value={status} onChange={setStatus} options={[{ v: 'open', label: 'Open' }, { v: 'done', label: 'Done' }, { v: 'all', label: 'All' }]} />
      <Gap h={8} />
      <Segmented value={pri} onChange={setPri} options={[{ v: 'all', label: 'Any' }, { v: 'high', label: 'High' }, { v: 'medium', label: 'Medium' }, { v: 'low', label: 'Low' }]} />
      {msg ? <Card tone="mint" style={{ marginTop: 12 }}><Small>{msg}</Small></Card> : null}
      <View style={{ gap: 10, marginTop: SP.lg }}>
        {list.loading && !list.data ? <Loading /> : list.error && !list.data ? <ErrorBox message={list.error} onRetry={list.reload} /> : visible.length === 0 ? (
          <Empty icon="checkmark-done-outline" title={status === 'open' ? 'You’re on track' : 'Nothing here yet'} body={status === 'open' ? 'New actions appear as your data changes.' : undefined} />
        ) : visible.map((a) => {
          const p = PRI[a.priority || 'medium']; const isOpen = open === a.action_id; const opts = TYPES[a.category];
          return (
            <Card key={a.action_id} style={a.status === 'done' ? { opacity: 0.6 } : undefined}>
              <Pressable onPress={() => setOpen(isOpen ? null : a.action_id)} accessibilityRole="button" style={{ flexDirection: 'row', gap: 10 }}>
                <Icon name={a.status === 'done' ? 'checkmark-circle' : 'ellipse-outline'} color={a.status === 'done' ? C.green : C.paper200} size={22} />
                <View style={{ flex: 1 }}>
                  <Txt noTr style={{ fontWeight: '700', textDecorationLine: a.status === 'done' ? 'line-through' : 'none' }}>{a.title}</Txt>
                  {a.impact_text ? <Small noTr style={{ marginTop: 2 }}>{a.impact_text}</Small> : null}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    <Chip label={p.label} bg={p.bg} color={p.fg} />
                    <Chip label={`+${a.impact_score} pts`} noTr />
                    {a.deadline ? <Chip label={`by ${prettyDate(a.deadline)}`} bg="#FBF0DF" color={C.amber} noTr /> : null}
                    {a.months_pending >= 2 && a.status === 'pending' ? <Chip label={`pending ${a.months_pending} months`} bg="#F8E3DF" color={C.red} /> : null}
                  </View>
                </View>
                <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={C.inkFaint} />
              </Pressable>
              {isOpen && (
                <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.paper100 }}>
                  <Small noTr>{a.body}</Small>
                  {a.status !== 'done' && confirm?.id !== a.action_id && (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
                      <Button small title="Mark done" icon="checkmark" onPress={() => { setConfirm({ id: a.action_id, step: 'ask' }); setAmount(''); setType(opts?.[0]?.v || ''); }} />
                      <Button small kind="ghost" title="Skip — not relevant" onPress={() => patch(`/actions/${a.action_id}/status`, { status: 'skipped' })} />
                    </View>
                  )}
                  {confirm?.id === a.action_id && confirm?.step === 'ask' && (
                    <Card tone="paper" style={{ marginTop: 12 }}>
                      <Txt style={{ fontWeight: '700' }}>Did you actually complete this?</Txt>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                        <Button small title="Yes, done" loading={busy} onPress={() => (opts ? setConfirm({ id: a.action_id, step: 'details' }) : complete(a, {}))} />
                        <Button small kind="secondary" title="Not yet" onPress={() => setConfirm(null)} />
                      </View>
                    </Card>
                  )}
                  {confirm?.id === a.action_id && confirm?.step === 'details' && opts && (
                    <Card tone="paper" style={{ marginTop: 12 }}>
                      <Label style={{ marginBottom: 8 }}>{a.category === 'insurance' ? 'What cover did you get?' : 'How much, and into what?'}</Label>
                      <Select label="Type" value={type} onChange={setType} options={opts} />
                      <MoneyInput label={a.category === 'insurance' ? 'Cover amount' : 'Amount (monthly or one-time)'} value={amount} onChange={setAmount} />
                      <Button small title="Save" loading={busy} onPress={() => complete(a, amount ? { invested_amount: rupeesToPaise(amount), invested_type: type } : {})} />
                      <Button small kind="ghost" title="Mark done without details" onPress={() => complete(a, {})} />
                    </Card>
                  )}
                </View>
              )}
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}
