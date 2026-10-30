// Native charts (react-native-svg): donut + legend, horizontal bars.
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { C } from '@/lib/theme';
import { inr } from '@/lib/format';
import { Num, Txt, Small } from './ui';

export const ALLOC_COLORS: Record<string, string> = { equity: C.pine700, debt: C.ocean, realEstate: C.amber, gold: C.gold, cash: C.mint500, other: C.inkFaint };
export const PALETTE = [C.pine700, C.mint500, C.ocean, C.amber, C.violet, C.berry, C.coral, C.gold, C.teal, C.inkFaint];

export function Donut({ data, size = 170, stroke = 22, children }: { data: { label: string; value: number; color: string }[]; size?: number; stroke?: number; children?: React.ReactNode }) {
  const total = data.reduce((a, d) => a + Math.max(0, d.value), 0) || 1;
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.paper100} strokeWidth={stroke} fill="none" />
          {data.map((d) => {
            const len = (Math.max(0, d.value) / total) * c;
            const el = <Circle key={d.label} cx={size / 2} cy={size / 2} r={r} stroke={d.color} strokeWidth={stroke} fill="none"
              strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-acc} />;
            acc += len;
            return el;
          })}
        </G>
      </Svg>
      <View style={{ alignItems: 'center', maxWidth: size - stroke * 2 - 8 }}>{children}</View>
    </View>
  );
}

export function Legend({ data, total, money }: { data: { label: string; value: number; color: string }[]; total?: number; money?: boolean }) {
  const tot = total ?? (data.reduce((a, d) => a + d.value, 0) || 1);
  return (
    <View style={{ gap: 8, alignSelf: 'stretch' }}>
      {data.map((d) => (
        <View key={d.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: d.color }} />
          <Txt style={{ flex: 1, fontSize: 14 }}>{d.label}</Txt>
          <Num style={{ fontWeight: '700', fontSize: 14 }}>{money ? inr(d.value) : `${Math.round((d.value / tot) * 100)}%`}</Num>
        </View>
      ))}
    </View>
  );
}

export function HBars({ rows, color = C.pine700 }: { rows: { label: string; value: number; right?: string }[]; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View style={{ gap: 10 }}>
      {rows.map((r) => (
        <View key={r.label}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Small style={{ flex: 1 }} numberOfLines={1}>{r.label}</Small>
            <Num style={{ fontWeight: '700', fontSize: 13 }}>{r.right ?? inr(r.value)}</Num>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: C.paper100 }}>
            <View style={{ width: `${(r.value / max) * 100}%`, height: 8, borderRadius: 4, backgroundColor: color }} />
          </View>
        </View>
      ))}
    </View>
  );
}
