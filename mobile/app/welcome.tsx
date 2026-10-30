// First screen for signed-out users: what PayWatch does, in one breath, then sign in.
import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { C, FONT, SP } from '@/lib/theme';
import { useLang } from '@/lib/i18n';
import { Button, Orb, Txt, Tiny } from '@/components/ui';

const COPY = {
  en: {
    kicker: 'YOUR MONEY BRAIN', title: 'Every dream,\nturned into a plan.',
    sub: 'Tell PayWatch what you want — a trip, a bike, your parents’ health cover. It quietly handles tax, insurance and investing in the background so it happens.',
    points: ['Plans every dream with real dates', 'Talk to it in English or Hindi', 'Tax prepared, insurance checked, savings put to work'],
    start: 'Get started', note: 'Financial education & organisation. Not investment advice.',
  },
  hi: {
    kicker: 'आपका मनी ब्रेन', title: 'हर सपना,\nएक पक्का प्लान।',
    sub: 'PayWatch को बताइए आप क्या चाहते हैं — एक ट्रिप, एक बाइक, माता-पिता का हेल्थ कवर। यह चुपचाप टैक्स, बीमा और निवेश संभालता है ताकि वह पूरा हो।',
    points: ['हर सपने का असली तारीख़ों के साथ प्लान', 'हिंदी या अंग्रेज़ी में बात करें', 'टैक्स तैयार, बीमा जाँचा, बचत काम पर'],
    start: 'शुरू करें', note: 'वित्तीय शिक्षा और व्यवस्था। निवेश सलाह नहीं।',
  },
};

export default function Welcome() {
  const { lang, setLang } = useLang();
  const c = COPY[lang];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.pine950 }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: SP.xl, paddingBottom: 40, flexGrow: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Txt noTr style={{ color: C.white, fontFamily: FONT.display, fontSize: 22 }}>Pay<Txt noTr style={{ color: C.mint400, fontStyle: 'italic', fontFamily: FONT.display, fontSize: 22 }}>Watch</Txt></Txt>
          <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, padding: 3 }}>
            {(['en', 'hi'] as const).map((l) => (
              <Pressable key={l} onPress={() => setLang(l)} accessibilityRole="button" style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: lang === l ? C.white : 'transparent' }}>
                <Txt noTr style={{ fontSize: 13, fontWeight: '700', color: lang === l ? C.pine950 : 'rgba(255,255,255,0.7)' }}>{l === 'en' ? 'EN' : 'हिं'}</Txt>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={{ alignItems: 'center', marginVertical: SP.xxl }}><Orb size={150} /></View>
        <Txt noTr style={{ color: C.mint300, fontSize: 11, fontWeight: '700', letterSpacing: 2.5 }}>{c.kicker}</Txt>
        <Txt noTr style={{ color: C.white, fontFamily: FONT.display, fontSize: 36, lineHeight: 42, marginTop: 10 }}>{c.title}</Txt>
        <Txt noTr style={{ color: 'rgba(255,255,255,0.72)', fontSize: 16, lineHeight: 24, marginTop: 14 }}>{c.sub}</Txt>
        <View style={{ marginTop: 20, gap: 10 }}>
          {c.points.map((p) => (
            <View key={p} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.mint500 + '33', alignItems: 'center', justifyContent: 'center' }}><Txt noTr style={{ color: C.mint300, fontWeight: '800', fontSize: 12 }}>✓</Txt></View>
              <Txt noTr style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, flex: 1 }}>{p}</Txt>
            </View>
          ))}
        </View>
        <View style={{ flex: 1, minHeight: 24 }} />
        <Button kind="mint" title={c.start} noTr onPress={() => router.push('/login')} />
        <Tiny noTr style={{ color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginTop: 12 }}>{c.note}</Tiny>
      </ScrollView>
    </SafeAreaView>
  );
}
