// Money-brain building blocks: dream cards, next moves, money flow, autopilot feed, future-you.
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect } from 'react-native-svg';
import { C, KIND_ART, R, SP, STATUS, FONT, shadow } from '@/lib/theme';
import { inr, prettyMonth, ago } from '@/lib/format';
import { useLang, TKey } from '@/lib/i18n';
import { useAssistant } from '@/lib/assistant';
import { ask } from '@/lib/api';
import { Card, Chip, Icon, Label, Num, Ring, Small, Soft, Tiny, Txt, H3, Segmented, Button } from './ui';

export function DreamCard({ d, onPress, width = 240 }: { d: any; onPress?: () => void; width?: number }) {
  const { t, lang } = useLang();
  const art = KIND_ART[d.kind] || KIND_ART.experience;
  const st = STATUS[d.status] || STATUS.on_track;
  const progress = d.adjustedTarget > 0 ? Math.min(1, (d.saved || 0) / d.adjustedTarget) : 0;
  const doneBy = d.status === 'achieved' ? t('home.ready') : prettyMonth(d.projectedDate || d.targetDate, lang);
  return (
    <Card onPress={onPress} style={{ width, padding: 0, overflow: 'hidden' }} accessibilityLabel={d.name}>
      <LinearGradient colors={[art.from, art.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 96, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', top: -30, right: -20, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.18)' }} />
        <Icon name={art.icon as any} size={40} color={C.white} />
      </LinearGradient>
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Txt noTr style={{ fontFamily: FONT.display, fontSize: 17, lineHeight: 21 }} numberOfLines={2}>{d.name}</Txt>
            <Chip label={t(`st.${d.status}` as TKey)} bg={st.bg} color={st.fg} style={{ marginTop: 6 }} noTr />
          </View>
          <Ring value={progress} size={46} stroke={5} color={st.color}><Num style={{ fontSize: 11, fontWeight: '700' }}>{Math.round(progress * 100)}%</Num></Ring>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <View style={{ flex: 1, backgroundColor: C.paper50, borderRadius: 10, padding: 8 }}>
            <Tiny noTr>{t('home.doneBy')}</Tiny><Txt noTr style={{ fontWeight: '700', fontSize: 14 }}>{doneBy}</Txt>
          </View>
          <View style={{ flex: 1, backgroundColor: C.paper50, borderRadius: 10, padding: 8 }}>
            <Tiny noTr>{t('home.planned')}</Tiny><Num style={{ fontWeight: '700', fontSize: 14 }} numberOfLines={1} adjustsFontSizeToFit>{inr(d.allocated)}{t('home.perMonth')}</Num>
          </View>
        </View>
        {d.earmarked > 0 && <Small style={{ color: C.pine700, fontWeight: '600', marginTop: 8 }} noTr>✨ {inr(d.earmarked)} {t('home.setAside').toLowerCase()}</Small>}
      </View>
    </Card>
  );
}

const URG: Record<string, { label: string; bg: string; fg: string }> = {
  now: { label: 'Now', bg: '#F8E3DF', fg: C.red },
  soon: { label: 'Soon', bg: '#FBF0DF', fg: C.amber },
  anytime: { label: 'Anytime', bg: C.paper100, fg: C.inkSoft },
};
export function NextMoves({ brain, max = 4 }: { brain: any; max?: number }) {
  const { t } = useLang();
  const { go } = useAssistant();
  if (!brain) return null;
  const moves: any[] = (brain.moves || []).slice(0, max);
  const plan = brain.plan || {};
  return (
    <Card>
      <Label>{t('home.moves')}</Label>
      <Txt noTr style={{ fontFamily: FONT.display, fontSize: 18, lineHeight: 24, marginTop: 4 }}>{plan.summary || 'Here’s what matters most right now.'}</Txt>
      {moves.length === 0 ? <Soft style={{ marginTop: 10 }}>You’re all caught up. I’ll tap you when something needs a decision.</Soft> : moves.map((m, i) => {
        const u = URG[m.urgency] || URG.anytime;
        return (
          <Pressable key={m.id} onPress={() => go(m.href)} accessibilityRole="button" style={({ pressed }) => [{ flexDirection: 'row', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.paper100, marginTop: i ? 0 : 8 }, pressed && { opacity: 0.7 }]}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.pine900, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}><Num style={{ color: C.white, fontSize: 12, fontWeight: '700' }}>{i + 1}</Num></View>
            <View style={{ flex: 1 }}>
              <Txt noTr style={{ fontWeight: '700', fontSize: 15 }}>{m.title}</Txt>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                <Chip label={u.label} bg={u.bg} color={u.fg} />
                {m.impact ? <Chip label={m.impact} noTr /> : null}
              </View>
              <Small noTr style={{ marginTop: 4 }}>{m.why}</Small>
              <Txt noTr style={{ color: C.pine700, fontWeight: '700', fontSize: 14, marginTop: 6 }}>{m.cta} →</Txt>
            </View>
          </Pressable>
        );
      })}
    </Card>
  );
}

/** Where the money goes each month — stacked river bar + legend (fits a phone better than a sankey). */
export function MoneyFlow({ map, plan }: { map: any; plan: any }) {
  const { t } = useLang();
  if (!map?.hasData || !(map.takeHome > 0)) return null;
  const items = plan?.items || [];
  const sum = (f: (i: any) => boolean) => items.filter(f).reduce((a: number, i: any) => a + (i.allocated || 0), 0);
  const buckets = [
    { k: 'flow.life', v: map.expenses || 0, c: '#94A3B8' },
    { k: 'flow.sip', v: (map.currentSip || 0) + sum((i) => i.id === 'virtual-future'), c: '#22C55E' },
    { k: 'flow.safety', v: sum((i) => i.kind === 'safety'), c: '#14B8A6' },
    { k: 'flow.dreams', v: sum((i) => !i.virtual && i.kind !== 'safety'), c: '#8B5CF6' },
    { k: 'flow.joy', v: plan?.joyBudget || 0, c: '#F59E0B' },
  ].filter((b) => b.v > 0) as { k: TKey; v: number; c: string }[];
  const total = buckets.reduce((a, b) => a + b.v, 0) || 1;
  const W = 320, H = 150;
  let y = 0;
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Label>{t('flow.income')}</Label>
        <Num style={{ fontFamily: FONT.display, fontSize: 22 }}>{inr(map.takeHome)}</Num>
      </View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ marginTop: 10 }}>
        <Rect x={0} y={0} width={12} height={H} rx={6} fill={C.pine900} />
        {buckets.map((b, i) => {
          const h = Math.max(6, (b.v / total) * (H - 4 * (buckets.length - 1)));
          const sy = (y / total) * H; const sh = (b.v / total) * H;
          const dy = buckets.slice(0, i).reduce((a, x) => a + Math.max(6, (x.v / total) * (H - 4 * (buckets.length - 1))) + 4, 0);
          y += b.v;
          return (
            <React.Fragment key={b.k}>
              <Path d={`M12,${sy} C160,${sy} 160,${dy} 300,${dy} L300,${dy + h} C160,${dy + h} 160,${sy + sh} 12,${sy + sh} Z`} fill={b.c} opacity={0.55} />
              <Rect x={300} y={dy} width={12} height={h} rx={4} fill={b.c} />
            </React.Fragment>
          );
        })}
      </Svg>
      <View style={{ marginTop: 12, gap: 8 }}>
        {buckets.map((b) => (
          <View key={b.k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: b.c }} />
            <Txt noTr style={{ flex: 1, fontSize: 14 }}>{t(b.k)}</Txt>
            <Num style={{ fontWeight: '700', fontSize: 14 }}>{inr(b.v)}</Num>
          </View>
        ))}
      </View>
    </Card>
  );
}

const KIND_ICON: Record<string, string> = { dream_captured: '✨', earmark: '🪙', dream_done: '🎉', dream_better: '📈', dream_worse: '⚠️', sooner: '⏩', later: '⏳', free_change: '💸', life_event: '🔔', plan_built: '🧠' };
export function AwayFeed({ items }: { items: any[] }) {
  const { t, lang } = useLang();
  if (!items?.length) return <Soft>{t('home.awayEmpty')}</Soft>;
  return (
    <View>
      {items.slice(0, 6).map((a, i) => (
        <View key={a.id} style={{ flexDirection: 'row', gap: 10, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: C.paper100 }}>
          <Txt noTr style={{ fontSize: 16, width: 22 }}>{KIND_ICON[a.kind] || '•'}</Txt>
          <View style={{ flex: 1 }}>
            <Txt noTr style={{ fontWeight: '600', fontSize: 14.5 }}>{a.title}</Txt>
            {a.body ? <Small noTr>{a.body}</Small> : null}
            <Tiny noTr style={{ marginTop: 2 }}>{ago(a.created_at, lang)}</Tiny>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Growth illustration: going it alone vs with a plan; slider replaced by +/- steppers (native-friendly). */
export function FutureYou({ networth, onRisk }: { networth: any; onRisk: (r: string) => Promise<void> }) {
  const g = networth?.growth;
  const [hi, setHi] = useState(1);
  const [monthly, setMonthly] = useState(25000);
  const touched = useRef(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { const rec = g?.improvedSurplus; if (!touched.current && rec) setMonthly(Math.max(1000, Math.round(rec / 100 / 1000) * 1000)); }, [g?.improvedSurplus]);
  if (!g?.available || !g.horizons?.length) return <Card><Soft>Add your income and savings in Settings to see what your future looks like.</Soft></Card>;
  const h = g.horizons[Math.min(hi, g.horizons.length - 1)];
  const years = h.years, rWith = (g.assumedReturnPct || 11) / 100, cur = g.current || 0;
  const lump = (p: number, r: number, n: number) => p * Math.pow(1 + r, n);
  const sipFV = (mp: number, r: number, n: number, step: number) => { let tot = 0, p = mp; const i = r / 12; for (let y = 0; y < n; y++) { for (let m = 0; m < 12; m++) tot = (tot + p) * (1 + i); p *= 1 + step; } return tot; };
  const withPW = lump(cur, rWith, years) + sipFV(monthly * 100, rWith, years, 0.08);
  const alone = lump(cur, 0.035, years);
  const step = (d: number) => { touched.current = true; setMonthly((m) => Math.max(1000, Math.min(500000, m + d))); };
  return (
    <View style={{ borderRadius: R.lg, padding: SP.lg, backgroundColor: C.pine900 }}>
      <Segmented dark value={hi} onChange={setHi} options={g.horizons.map((x: any, i: number) => ({ v: i, label: `${x.years}y` }))} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
        <Small style={{ color: 'rgba(255,255,255,0.6)' }}>If you invest each month</Small>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={() => step(-1000)} hitSlop={8} accessibilityLabel="Less" style={stepBtn}><Icon name="remove" color={C.white} /></Pressable>
          <Num style={{ color: C.white, fontFamily: FONT.display, fontSize: 18, minWidth: 90, textAlign: 'center' }}>{inr(monthly * 100)}</Num>
          <Pressable onPress={() => step(1000)} hitSlop={8} accessibilityLabel="More" style={stepBtn}><Icon name="add" color={C.white} /></Pressable>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <View style={{ flex: 1, borderRadius: R.md, padding: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
          <Tiny style={{ color: 'rgba(255,255,255,0.45)' }}>GOING IT ALONE</Tiny>
          <Num style={{ color: 'rgba(255,255,255,0.75)', fontFamily: FONT.display, fontSize: 18, marginTop: 4 }} adjustsFontSizeToFit numberOfLines={1}>{inr(alone)}</Num>
        </View>
        <View style={{ flex: 1, borderRadius: R.md, padding: 12, backgroundColor: 'rgba(47,188,155,0.12)', borderWidth: 2, borderColor: C.mint500 }}>
          <Tiny style={{ color: C.mint300 }}>WITH A PLAN</Tiny>
          <Num style={{ color: C.mint300, fontFamily: FONT.display, fontSize: 18, marginTop: 4 }} adjustsFontSizeToFit numberOfLines={1}>{inr(withPW)}</Num>
        </View>
      </View>
      <Small style={{ color: 'rgba(255,255,255,0.6)', marginTop: 14 }}>Risk: {g.riskAppetite} · ~{g.assumedReturnPct}%/yr</Small>
      <Segmented dark style={{ marginTop: 8 }} value={g.riskAppetite} onChange={async (r: string) => { if (saving) return; setSaving(true); try { await onRisk(r); } finally { setSaving(false); } }}
        options={[{ v: 'conservative', label: 'Cautious' }, { v: 'moderate', label: 'Balanced' }, { v: 'aggressive', label: 'Growth' }]} />
      <Tiny style={{ color: 'rgba(255,255,255,0.4)', marginTop: 10 }}>Illustration, not a guarantee. Idle savings ~3.5% vs your plan ~{g.assumedReturnPct}%/yr with an 8% yearly step-up. Markets go up and down; nominal, before inflation.</Tiny>
    </View>
  );
}
const stepBtn = { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center' as const, justifyContent: 'center' as const };

/** Live "what does this usually cost?" while typing a dream. */
export function PriceGuide({ text, selected, onPick }: { text: string; selected?: string; onPick: (rupees: string) => void }) {
  const [g, setG] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    const q = text.trim();
    if (q.length < 3) { setG(null); return; }
    const my = ++seq.current;
    const tm = setTimeout(async () => {
      setLoading(true);
      try { const r = await ask('/brain/price-guide', { text: q }, 15000); if (my === seq.current) setG(r?.found ? r : null); }
      catch { if (my === seq.current) setG(null); }
      finally { if (my === seq.current) setLoading(false); }
    }, 550);
    return () => clearTimeout(tm);
  }, [text]);
  if (!g && !loading) return null;
  return (
    <View style={{ borderRadius: R.md, borderWidth: 1, borderColor: C.mint500 + '55', backgroundColor: C.mint100 + 'AA', padding: 12, marginBottom: SP.lg }} accessibilityLiveRegion="polite">
      {loading && !g ? <Small>Looking up typical prices…</Small> : g && (
        <>
          <Txt noTr style={{ fontWeight: '700', color: C.pine800, fontSize: 14 }}>{g.item}{g.location ? ` · ${g.location}` : ''}</Txt>
          <Small noTr>Usually {inr(g.low)} – {inr(g.high)}</Small>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ gap: 8 }}>
            {g.options.map((o: any) => {
              const rupees = String(Math.round(o.amount / 100));
              const on = selected === rupees;
              return (
                <Pressable key={o.label} onPress={() => onPick(rupees)} accessibilityRole="button"
                  style={{ borderRadius: 12, borderWidth: 1, borderColor: on ? C.pine900 : C.paper200, backgroundColor: on ? C.pine900 : C.white, paddingHorizontal: 12, paddingVertical: 8, maxWidth: 220 }}>
                  <Tiny noTr style={{ color: on ? C.mint300 : C.inkFaint }}>{o.label}</Tiny>
                  <Num style={{ fontWeight: '700', fontSize: 15, color: on ? C.white : C.ink }}>{inr(o.amount)}</Num>
                  {o.note ? <Tiny noTr numberOfLines={2} style={{ color: on ? 'rgba(255,255,255,0.7)' : C.inkFaint }}>{o.note}</Tiny> : null}
                </Pressable>
              );
            })}
          </ScrollView>
          <Tiny noTr style={{ marginTop: 6 }}>{g.basis} Tap one to use it.</Tiny>
          <Tiny noTr>{g.disclaimer}{g.source === 'ai' ? ' · AI estimate' : ''}</Tiny>
        </>
      )}
    </View>
  );
}

export function ScoreCard({ score }: { score: any }) {
  const { t } = useLang();
  if (!score) return null;
  const s = Number(score.score) || 0;
  const color = s >= 75 ? C.green : s >= 50 ? C.mint500 : s >= 35 ? C.amber : C.red;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <Ring value={s / 100} size={86} stroke={9} color={color}><Num style={{ fontFamily: FONT.display, fontSize: 26 }}>{s}</Num></Ring>
      <View style={{ flex: 1 }}>
        <Label>{t('home.health')}</Label>
        {score.change_since_last_month ? <Txt noTr style={{ color: score.change_since_last_month > 0 ? C.green : C.red, fontWeight: '700', marginTop: 2 }}>{score.change_since_last_month > 0 ? '▲' : '▼'} {Math.abs(score.change_since_last_month)}</Txt> : null}
        <Small style={{ marginTop: 2 }}>Out of 100, across savings, insurance, diversification, safety net, debt and tax.</Small>
      </View>
    </View>
  );
}
export { shadow };
