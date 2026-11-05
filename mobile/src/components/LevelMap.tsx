// "Money Quest" (native) — the action plan as a Candy-Crush-style level path. Stars = done, pulsing pin = you are here.
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, ScrollView, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { C } from '@/lib/theme';
import { Txt, Tiny } from '@/components/ui';

export interface Level { id: string; title: string; done: boolean; points: number; n: number }
const WORLDS = ['🌱 Sprout Valley', '🛡️ Shield Fort', '🧾 Tax Canyon', '🌳 Wealth Woods', '🏔️ Freedom Peak'];
const BANDS = ['#E6F6EE', '#E4F0FA', '#F1EAFB', '#FFF3DA', '#FCE7F1'];

export function buildLevels(actions: any[]): Level[] {
  const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const done = actions.filter((a) => a.status === 'done').sort((a, b) => String(a.completed_at || '').localeCompare(String(b.completed_at || '')));
  const open = actions.filter((a) => ['pending', 'in_progress', 'deferred'].includes(a.status))
    .sort((a, b) => (rank[a.priority || 'medium'] - rank[b.priority || 'medium']) || (b.impact_score - a.impact_score));
  return [...done, ...open].map((a, i) => ({ id: a.action_id, title: a.title, done: a.status === 'done', points: Number(a.impact_score) || 0, n: i + 1 }));
}

const GAP = 84, H = 190, AMP = 46, R = 22;

export function LevelMap({ actions, onPick }: { actions: any[]; onPick: (id: string) => void }) {
  const levels = useMemo(() => buildLevels(actions), [actions]);
  const current = levels.find((l) => !l.done);
  const done = levels.filter((l) => l.done).length;
  const xpDone = levels.filter((l) => l.done).reduce((s, l) => s + l.points, 0);
  const xpAll = levels.reduce((s, l) => s + l.points, 0) || 1;
  const width = Math.max(levels.length, 1) * GAP + 60;
  const pos = (n: number) => ({ x: 40 + (n - 1) * GAP, y: H / 2 + Math.sin((n - 1) * 1.1) * AMP });
  const pts = levels.map((l) => pos(l.n));
  const seg = (k: number) => pts.slice(0, k).reduce((d, p, i) => {
    if (i === 0) return `M${p.x},${p.y}`;
    const q = pts[i - 1]; const mx = (q.x + p.x) / 2;
    return `${d} C${mx},${q.y} ${mx},${p.y} ${p.x},${p.y}`;
  }, '');
  const scroll = useRef<any>(null);
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]));
    loop.start(); return () => loop.stop();
  }, [pulse]);
  useEffect(() => {
    if (current) setTimeout(() => scroll.current?.scrollTo({ x: Math.max(0, pos(current.n).x - 150), animated: true }), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, levels.length]);
  const levelNo = current ? current.n : levels.length;
  const bob = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });

  return (
    <View style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: C.white, borderWidth: 1, borderColor: C.paper200 }}>
      <View style={{ backgroundColor: C.pine900, padding: 16 }}>
        <Tiny style={{ color: C.mint300, fontWeight: '800', letterSpacing: 2 }}>MONEY QUEST</Tiny>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Txt style={{ color: C.white, fontSize: 26, fontWeight: '800' }}>{current ? `Level ${levelNo}` : levels.length ? 'All levels cleared!' : 'Level 1'}</Txt>
          <Tiny noTr style={{ color: 'rgba(255,255,255,.7)' }}>{`${done}/${levels.length} done`}</Tiny>
        </View>
        <Tiny style={{ color: 'rgba(255,255,255,.75)' }}>{WORLDS[Math.min(WORLDS.length - 1, Math.floor((Math.max(1, levelNo) - 1) / 5))]}</Tiny>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,.15)', marginTop: 10, overflow: 'hidden' }}>
          <View style={{ height: 8, width: `${Math.round((xpDone / xpAll) * 100)}%`, backgroundColor: C.gold }} />
        </View>
        <Tiny noTr style={{ color: 'rgba(255,255,255,.7)', marginTop: 4 }}>{`${xpDone} / ${xpAll} score points earned`}</Tiny>
      </View>
      {levels.length ? (
        <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ width, height: H }}>
            {Array.from({ length: Math.ceil(levels.length / 5) }).map((_, w) => {
              const left = pos(w * 5 + 1).x - GAP / 2; const right = pos(Math.min(levels.length, w * 5 + 5)).x + GAP / 2;
              return <View key={w} style={{ position: 'absolute', left: Math.max(0, left), width: right - Math.max(0, left), top: 0, bottom: 0, backgroundColor: BANDS[Math.min(BANDS.length - 1, w)] }} />;
            })}
            <Svg width={width} height={H} style={{ position: 'absolute' }}>
              <Path d={seg(pts.length)} stroke={C.paper200} strokeWidth={12} fill="none" strokeLinecap="round" />
              <Path d={seg(Math.max(1, done + (current ? 1 : 0)))} stroke={C.mint500} strokeWidth={12} fill="none" strokeLinecap="round" />
            </Svg>
            {levels.map((l) => {
              const p = pos(l.n); const cur = current?.id === l.id; const size = cur ? R * 2.5 : R * 2;
              return (
                <Pressable key={l.id} onPress={() => onPick(l.id)} accessibilityLabel={`Level ${l.n}: ${l.title}`}
                  style={{ position: 'absolute', left: p.x - size / 2, top: p.y - size / 2, width: size, height: size }}>
                  {cur && (
                    <Animated.View style={{ position: 'absolute', top: -34, left: size / 2 - 11, transform: [{ translateY: bob }] }}>
                      <Txt noTr style={{ fontSize: 22 }}>📍</Txt>
                    </Animated.View>
                  )}
                  <View style={{ flex: 1, borderRadius: size / 2, borderWidth: 4, borderColor: C.white, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: l.done ? C.gold : cur ? C.pine600 : C.paper100 }}>
                    <Txt noTr style={{ color: l.done || cur ? C.white : C.inkFaint, fontWeight: '800', fontSize: cur ? 19 : 15 }}>{l.done ? '★' : String(l.n)}</Txt>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      ) : <Tiny style={{ padding: 16 }}>Your levels appear here as PayWatch finds steps for you.</Tiny>}
      {current ? (
        <Pressable onPress={() => onPick(current.id)} style={{ padding: 14, borderTopWidth: 1, borderTopColor: C.paper100 }}>
          <Tiny noTr style={{ fontWeight: '800', letterSpacing: 1.5 }}>{`NEXT UP · LEVEL ${current.n}`}</Tiny>
          <Txt style={{ fontWeight: '700', color: C.ink, marginTop: 2 }}>{`${current.title} →`}</Txt>
          <Tiny noTr>{`+${current.points} score points when you finish it`}</Tiny>
        </Pressable>
      ) : null}
    </View>
  );
}
