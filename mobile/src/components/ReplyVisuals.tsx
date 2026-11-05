// Visual cards under an Ask PayWatch reply (D-55) — same data as the web: dream plan, cost split,
// savings path, price tiers and the afford verdict. Numbers come from the server's brain (paise).
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path as SvgPath, Text as SvgText } from 'react-native-svg';
import { inr, prettyMonth } from '@/lib/format';
import { C } from '@/lib/theme';
import { Txt, Tiny, Small } from '@/components/ui';

type V = any;
const PALETTE = [C.pine700, C.mint500, C.gold, C.ocean, C.violet, C.berry];
const isHi = (s?: string) => /[ऀ-ॿ]/.test(s || '');
const STATUS: Record<string, { en: string; hi: string; fg: string; bg: string }> = {
  achieved: { en: 'Done', hi: 'पूरा', fg: C.pine800, bg: C.mint100 },
  on_track: { en: 'On track', hi: 'सही रास्ते पर', fg: C.pine800, bg: C.mint100 },
  stretch: { en: 'A stretch', hi: 'थोड़ा मुश्किल', fg: C.gold700, bg: C.gold100 },
  needs_tradeoff: { en: 'Needs a trade-off', hi: 'कुछ बदलना होगा', fg: C.red, bg: '#F8E3DF' },
};
const VERDICT: Record<string, { en: string; hi: string; bg: string; icon: string }> = {
  yes_now: { en: 'Yes, today', hi: 'हाँ, आज ही', bg: C.green, icon: '✓' },
  yes_by: { en: 'Yes, with a plan', hi: 'हाँ, प्लान से', bg: C.pine900, icon: '✓' },
  stretch: { en: 'A stretch', hi: 'थोड़ा मुश्किल', bg: C.gold, icon: '!' },
  not_yet: { en: 'Not yet', hi: 'अभी नहीं', bg: C.red, icon: '×' },
};
const card = { borderRadius: 14, borderWidth: 1, borderColor: C.paper200, backgroundColor: C.white, padding: 12 } as const;
const Title = ({ children }: { children: string }) => <Tiny noTr style={{ fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 }}>{children.toUpperCase()}</Tiny>;
const Note = ({ children }: { children?: string }) => (children ? <Tiny noTr style={{ marginTop: 8 }}>{children}</Tiny> : null);

function Dream({ v }: { v: V }) {
  const hi = isHi(v.title); const st = STATUS[v.status] || STATUS.on_track;
  const r = 24, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, v.progress || 0));
  const cells: [string, string][] = [
    [hi ? 'लक्ष्य' : 'Target', inr(v.target)], [hi ? 'जमा' : 'Saved', inr(v.saved)],
    [hi ? 'हर महीने' : 'Per month', inr(v.allocated || v.monthlyNeed)], [hi ? 'कब तक' : 'Done by', prettyMonth(v.eta || v.targetDate, hi ? 'hi' : 'en')],
  ];
  return (
    <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: C.paper200 }}>
      <View style={{ backgroundColor: C.pine900, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Svg width={58} height={58} viewBox="0 0 58 58">
          <Circle cx={29} cy={29} r={r} stroke="rgba(255,255,255,.15)" strokeWidth={6} fill="none" />
          <Circle cx={29} cy={29} r={r} stroke={C.mint400} strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray={`${c}`} strokeDashoffset={c * (1 - p)} transform="rotate(-90 29 29)" />
          <SvgText x={29} y={33} textAnchor="middle" fontSize={12} fontWeight="700" fill="#fff">{`${Math.round(p * 100)}%`}</SvgText>
        </Svg>
        <View style={{ flex: 1 }}>
          <Txt noTr style={{ color: C.white, fontWeight: '700' }} numberOfLines={2}>{v.title}</Txt>
          <View style={{ alignSelf: 'flex-start', marginTop: 6, backgroundColor: st.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Txt noTr style={{ fontSize: 10.5, fontWeight: '700', color: st.fg }}>{hi ? st.hi : st.en}</Txt>
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', backgroundColor: C.white }}>
        {cells.map(([l, val]) => (
          <View key={l} style={{ width: '50%', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderColor: C.paper100 }}>
            <Tiny noTr style={{ fontWeight: '700' }}>{l}</Tiny>
            <Txt noTr style={{ fontWeight: '700', color: C.ink }}>{val}</Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

function Breakdown({ v }: { v: V }) {
  return (
    <View style={card}>
      <Title>{v.title}</Title>
      <View style={{ flexDirection: 'row', height: 10, borderRadius: 999, overflow: 'hidden' }}>
        {v.parts.map((p: any, i: number) => <View key={i} style={{ flex: p.pct, backgroundColor: PALETTE[i % PALETTE.length] }} />)}
      </View>
      <View style={{ marginTop: 10, gap: 6 }}>
        {v.parts.map((p: any, i: number) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: PALETTE[i % PALETTE.length] }} />
            <Small noTr style={{ flex: 1 }}>{p.label}</Small>
            <Txt noTr style={{ fontWeight: '700', fontSize: 13, color: C.ink }}>{inr(p.amount)}</Txt>
          </View>
        ))}
      </View>
      <Note>{v.note}</Note>
    </View>
  );
}

function PathCard({ v }: { v: V }) {
  const hi = isHi(v.title);
  const W = 300, H = 110, P = 8;
  const months = Array.from(new Set(v.series.flatMap((s: any) => s.points.map((p: any) => p.m)))).sort() as string[];
  const x = (m: string) => P + ((W - 2 * P) * months.indexOf(m)) / Math.max(1, months.length - 1);
  const y = (val: number) => H - P - ((H - 2 * P) * val) / Math.max(1, v.target);
  const d = (pts: any[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.m).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const colors = [C.mint500, C.gold];
  return (
    <View style={card}>
      <Title>{v.title}</Title>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Line x1={P} x2={W - P} y1={y(v.target)} y2={y(v.target)} stroke={C.paper200} strokeDasharray="4 4" />
        <SvgText x={W - P} y={y(v.target) - 4} textAnchor="end" fontSize={9} fill={C.inkFaint}>{inr(v.target)}</SvgText>
        {v.series.map((s: any, i: number) => <SvgPath key={i} d={d(s.points)} fill="none" stroke={colors[i]} strokeWidth={i ? 2 : 2.5} strokeDasharray={i ? '5 4' : undefined} />)}
      </Svg>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        {v.series.map((s: any, i: number) => (
          <View key={i} style={{ flex: 1, backgroundColor: C.paper50, borderRadius: 10, borderWidth: 1, borderColor: C.paper200, padding: 8 }}>
            <Tiny noTr style={{ color: colors[i], fontWeight: '700' }}>{s.label}</Tiny>
            <Txt noTr style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>{`${hi ? 'पूरा: ' : 'Done: '}${prettyMonth(s.reach, hi ? 'hi' : 'en')}`}</Txt>
          </View>
        ))}
      </View>
      <Note>{v.note}</Note>
    </View>
  );
}

function Tiers({ v }: { v: V }) {
  const max = Math.max(1, ...v.options.map((o: any) => o.amount));
  return (
    <View style={card}>
      <Title>{v.title}</Title>
      <View style={{ gap: 8 }}>
        {v.options.map((o: any, i: number) => (
          <View key={i}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
              <Small noTr style={{ flex: 1, fontWeight: i === v.highlight ? '700' : '400', color: i === v.highlight ? C.pine800 : C.inkSoft }}>{`${o.label}${i === v.highlight ? ' ★' : ''}`}</Small>
              <Txt noTr style={{ fontWeight: '700', fontSize: 13, color: C.ink }}>{inr(o.amount)}</Txt>
            </View>
            <View style={{ height: 7, borderRadius: 999, backgroundColor: C.paper100, overflow: 'hidden' }}>
              <View style={{ width: `${(o.amount / max) * 100}%`, height: '100%', borderRadius: 999, backgroundColor: i === v.highlight ? C.pine700 : C.mint300 }} />
            </View>
          </View>
        ))}
      </View>
      <Note>{v.note}</Note>
    </View>
  );
}

function Afford({ v }: { v: V }) {
  const hi = isHi(v.headline); const vd = VERDICT[v.verdict] || VERDICT.stretch;
  return (
    <View style={[card, { flexDirection: 'row', gap: 10 }]}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: vd.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Txt noTr style={{ color: C.white, fontWeight: '800' }}>{vd.icon}</Txt>
      </View>
      <View style={{ flex: 1 }}>
        <Tiny noTr style={{ fontWeight: '700' }}>{`${hi ? 'क्या मैं ले सकता हूँ?' : 'Can I afford it?'} · ${hi ? vd.hi : vd.en}`}</Tiny>
        <Small noTr style={{ marginTop: 3, color: C.ink }}>{v.headline}</Small>
        {v.affects?.length > 0 && <Tiny noTr style={{ marginTop: 4, color: C.amber }}>{`${hi ? 'असर: ' : 'Moves: '}${v.affects.map((a: any) => `${a.name}${a.newDate ? ` → ${prettyMonth(a.newDate, hi ? 'hi' : 'en')}` : ''}`).join(', ')}`}</Tiny>}
      </View>
    </View>
  );
}

export function ReplyVisuals({ visuals }: { visuals?: V[] | null }) {
  if (!visuals?.length) return null;
  return (
    <View style={{ marginTop: 10, gap: 8 }}>
      {visuals.map((v, i) => v.type === 'dream' ? <Dream key={i} v={v} />
        : v.type === 'breakdown' ? <Breakdown key={i} v={v} />
          : v.type === 'path' ? <PathCard key={i} v={v} />
            : v.type === 'tiers' ? <Tiers key={i} v={v} />
              : v.type === 'afford' ? <Afford key={i} v={v} /> : null)}
    </View>
  );
}
