// "Money Wrapped" pamphlets (D-59) — native. Front: the news; tap to flip: what it means for you.
import React, { useRef, useState } from 'react';
import { Animated, Dimensions, Easing, FlatList, Pressable, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { C } from '@/lib/theme';
import { Txt, Tiny, Small } from '@/components/ui';

const THEME: Record<string, [string, string, string]> = {
  rates: ['#0F2F57', '#2E86C1', '#9BE7FF'], inflation: ['#7C2D12', '#F59E0B', '#FFE29A'], tax: ['#3B0F6E', '#8E5FD0', '#F0C4FF'],
  markets: ['#053B2F', '#2FBC9B', '#C8FFE9'], insurance: ['#6B0F3F', '#D45FA2', '#FFD1EA'], banking: ['#0A3D4E', '#45A6C2', '#CFF5FF'],
  savings: ['#123D20', '#3FBF6A', '#D9FFD0'], gold: ['#5C2A06', '#E0A23B', '#FFF0B8'], economy: ['#1C2430', '#5B6B82', '#E2E8F0'],
  scam: ['#5E0B0B', '#E5484D', '#FFD6D6'], other: ['#07211D', '#258274', '#C7F0E4'],
};
const W = Math.min(320, Dimensions.get('window').width * 0.8);
const H = 440;

function Bg({ id, from, to, accent, i }: { id: string; from: string; to: string; accent: string; i: number }) {
  return (
    <Svg width={W} height={H} style={{ position: 'absolute' }}>
      <Defs><LinearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={from} /><Stop offset="1" stopColor={to} /></LinearGradient></Defs>
      <Rect width={W} height={H} rx={28} fill={`url(#g${id})`} />
      {i % 3 === 0 && <Circle cx={W - 30} cy={H - 30} r={95} fill={accent} opacity={0.3} />}
      {i % 3 === 1 && <><Circle cx={W - 30} cy={H - 30} r={90} fill="none" stroke={accent} strokeWidth={20} opacity={0.3} /><Circle cx={W - 30} cy={H - 30} r={38} fill={accent} opacity={0.3} /></>}
      {i % 3 === 2 && <Path d={`M${W - 150} ${H - 60}c30-40 100-50 140-10s20 90-30 100-130-40-110-90z`} fill={accent} opacity={0.3} />}
    </Svg>
  );
}

function Pamphlet({ p, i, onGo, onOpen }: { p: any; i: number; onGo: (href: string) => void; onOpen: (url: string) => void }) {
  const [from, to, accent] = THEME[p.theme] || THEME.other;
  const v = useRef(new Animated.Value(0)).current;
  const [flipped, setFlipped] = useState(false);
  const flip = () => {
    const next = !flipped; setFlipped(next);
    Animated.timing(v, { toValue: next ? 1 : 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };
  const front = v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const back = v.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const face = { position: 'absolute' as const, width: W, height: H, borderRadius: 28, overflow: 'hidden' as const, backfaceVisibility: 'hidden' as const, padding: 22 };
  return (
    <Pressable onPress={flip} accessibilityRole="button" accessibilityLabel={flipped ? 'Show the news' : 'See what this means for you'} style={{ width: W, height: H }}>
      <Animated.View style={[face, { padding: 0, transform: [{ perspective: 1200 }, { rotateY: front }] }]}>
        <Bg id={p.id.replace(/[^a-z0-9]/gi, '')} from={from} to={to} accent={accent} i={i} />
        <View style={{ flex: 1, padding: 22 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ backgroundColor: accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><Txt style={{ color: from, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }}>{String(p.themeLabel).toUpperCase()}</Txt></View>
            {p.forYou ? <View style={{ borderColor: 'rgba(255,255,255,.4)', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Txt style={{ color: C.white, fontSize: 10, fontWeight: '700' }}>For you</Txt></View> : null}
          </View>
          <Txt noTr style={{ color: 'rgba(255,255,255,.75)', fontSize: 11, fontWeight: '700', letterSpacing: 2, marginTop: 18 }}>{String(p.kicker).toUpperCase()}</Txt>
          {p.big ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 2 }}>
              <Txt noTr style={{ color: C.white, fontSize: 64, fontWeight: '800', lineHeight: 68 }}>{p.big}</Txt>
              {p.delta ? <View style={{ backgroundColor: accent, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 12 }}><Txt noTr style={{ color: from, fontWeight: '800', fontSize: 12 }}>{`${p.delta.up ? '▲' : '▼'} ${p.delta.text}`}</Txt></View> : null}
            </View>
          ) : null}
          <Txt style={{ color: C.white, fontSize: p.big ? 20 : 25, lineHeight: p.big ? 25 : 31, fontWeight: '800', marginTop: 10 }} numberOfLines={7}>{p.headline}</Txt>
          <View style={{ marginTop: 'auto', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 }}>
            <Tiny noTr style={{ color: 'rgba(255,255,255,.75)', flex: 1 }}>{`Source: ${p.source}`}</Tiny>
            <View style={{ backgroundColor: C.white, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}><Txt style={{ color: from, fontSize: 11, fontWeight: '800' }}>↻ For you</Txt></View>
          </View>
        </View>
      </Animated.View>

      <Animated.View style={[face, { backgroundColor: '#FFF9EE', transform: [{ perspective: 1200 }, { rotateY: back }] }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt style={{ color: to, fontSize: 10, fontWeight: '800', letterSpacing: 2 }}>WHAT IT MEANS FOR YOU</Txt>
          <Tiny>tap to flip</Tiny>
        </View>
        <Txt style={{ fontSize: 21, lineHeight: 26, fontWeight: '800', color: C.ink, marginTop: 10 }}>{p.backTitle}</Txt>
        {p.backBody ? <Small style={{ marginTop: 8 }}>{p.backBody}</Small> : null}
        {(p.impacts || []).slice(0, 3).map((m: any, k: number) => (
          <View key={k} style={{ marginTop: 10, backgroundColor: C.white, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: C.paper100 }}>
            <Txt style={{ fontWeight: '800', fontSize: 13.5, color: C.ink }}>{m.title}</Txt>
            <Small style={{ marginTop: 3 }} numberOfLines={3}>{m.detail}</Small>
            <Txt style={{ color: to, fontWeight: '800', fontSize: 12.5, marginTop: 6 }} onPress={() => onGo(m.href)}>{`${m.cta} →`}</Txt>
          </View>
        ))}
        {p.link ? <Txt style={{ marginTop: 'auto', fontSize: 11.5, fontWeight: '700', color: C.inkSoft, textDecorationLine: 'underline' }} onPress={() => onOpen(p.link)}>{`Read the original ↗`}</Txt> : null}
      </Animated.View>
    </Pressable>
  );
}

export function FlipDeck({ cards, onGo, onOpen }: { cards: any[]; onGo: (href: string) => void; onOpen: (url: string) => void }) {
  const [idx, setIdx] = useState(0);
  return (
    <View>
      <FlatList
        data={cards} horizontal keyExtractor={(c) => c.id} showsHorizontalScrollIndicator={false}
        snapToInterval={W + 16} decelerationRate="fast" contentContainerStyle={{ gap: 16, paddingVertical: 8, paddingRight: 24 }}
        onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / (W + 16)))}
        renderItem={({ item, index }) => <Pamphlet p={item} i={index} onGo={onGo} onOpen={onOpen} />}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 8 }}>
        {cards.slice(0, 16).map((c, i) => <View key={c.id} style={{ height: 6, width: i === idx ? 18 : 6, borderRadius: 3, backgroundColor: i === idx ? C.pine800 : C.paper200 }} />)}
      </View>
    </View>
  );
}
