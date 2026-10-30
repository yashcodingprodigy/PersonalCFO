// The assistant's pinned guide — "what to do / what to avoid" — floating above the
// screen it opened. Collapsible and dismissible; stays while the user browses.
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAssistant } from '@/lib/assistant';
import { useLang } from '@/lib/i18n';
import { C, R, shadow } from '@/lib/theme';
import { Icon, Txt, Tiny, Orb } from './ui';

export function GuideCard({ bottomOffset = 90 }: { bottomOffset?: number }) {
  const { guide, setGuide, openChat } = useAssistant();
  const { t } = useLang();
  const [min, setMin] = useState(false);
  const insets = useSafeAreaInsets();
  if (!guide) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 12, right: 12, bottom: insets.bottom + bottomOffset, zIndex: 50 }}>
      <View style={[{ borderRadius: R.lg, backgroundColor: C.white, overflow: 'hidden', borderWidth: 1, borderColor: C.mint500 + '55' }, shadow, { elevation: 8 }]} accessibilityRole="summary">
        <Pressable onPress={() => setMin(!min)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.pine900, paddingHorizontal: 12, paddingVertical: 10 }}>
          <View style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}><Orb size={20} /></View>
          <Txt style={{ color: C.white, fontWeight: '700', flex: 1, fontSize: 14 }} numberOfLines={2}>{guide.title}</Txt>
          <Icon name={min ? 'chevron-up' : 'chevron-down'} color="rgba(255,255,255,0.8)" size={18} />
          <Pressable onPress={() => setGuide(null)} hitSlop={10} accessibilityLabel={t('common.close')}><Icon name="close" color="rgba(255,255,255,0.8)" size={18} /></Pressable>
        </Pressable>
        {!min && (
          <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ padding: 12 }}>
            {guide.intro ? <Txt style={{ fontSize: 14, color: C.inkSoft, marginBottom: 8 }}>{guide.intro}</Txt> : null}
            <Txt style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: C.pine700 }}>{t('gd.do').toUpperCase()}</Txt>
            {guide.doThis.map((x) => (
              <View key={x} style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <Txt noTr style={{ color: C.mint500, fontWeight: '800' }}>✓</Txt><Txt style={{ flex: 1, fontSize: 14 }}>{x}</Txt>
              </View>
            ))}
            {guide.avoid.length > 0 && <>
              <Txt style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: C.red, marginTop: 12 }}>{t('gd.avoid').toUpperCase()}</Txt>
              {guide.avoid.map((x) => (
                <View key={x} style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  <Txt noTr style={{ color: C.red, fontWeight: '800' }}>✕</Txt><Txt style={{ flex: 1, fontSize: 14 }}>{x}</Txt>
                </View>
              ))}
            </>}
            {guide.footnote ? <Tiny style={{ marginTop: 10 }}>{guide.footnote}</Tiny> : null}
            <Pressable onPress={() => openChat()} style={{ marginTop: 10 }}><Txt style={{ color: C.pine700, fontWeight: '700', fontSize: 14 }}>{t('gd.ask')} →</Txt></Pressable>
          </ScrollView>
        )}
      </View>
    </View>
  );
}
