// Alerts — the proactive inbox. Tap to open where it gets done; swipe-free actions for clarity.
import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApi } from '@/lib/hooks';
import { del, patch, post } from '@/lib/api';
import { inr, prettyDate } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { useAssistant } from '@/lib/assistant';
import { C, R, SP } from '@/lib/theme';
import { Button, Card, Chip, Empty, ErrorBox, H1, Icon, Loading, Screen, Segmented, Small, Soft, Tiny, Txt, H3 } from '@/components/ui';

const SEV: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  urgent: { icon: 'alert-circle', color: C.red, bg: '#F8E3DF', label: 'Urgent' },
  warning: { icon: 'warning', color: C.amber, bg: '#FBF0DF', label: 'Heads up' },
  info: { icon: 'information-circle', color: C.ocean, bg: '#D6EAF8', label: 'FYI' },
  good: { icon: 'checkmark-circle', color: C.green, bg: '#E2F3E5', label: 'Good news' },
};

export default function Alerts() {
  const { t } = useLang();
  const { go } = useAssistant();
  const { data, loading, error, reload, refreshing } = useApi<{ alerts: any[]; unread: number }>('/alerts');
  const brief = useApi<any>('/alerts/briefing', { auto: false });
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const alerts = (data?.alerts || []).filter((a) => filter === 'all' || a.status === 'unread');

  const open = async (a: any) => {
    if (a.status === 'unread') patch(`/alerts/${a.id}/read`, {}).catch(() => {});
    if (a.action_href) go(a.action_href);
  };
  const dismiss = (a: any) => Alert.alert('Dismiss this alert?', a.title, [{ text: 'Cancel', style: 'cancel' }, { text: 'Dismiss', style: 'destructive', onPress: () => del(`/alerts/${a.id}`).catch(() => {}) }]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.paper }}>
      <Screen onRefresh={() => { reload(); brief.reload(); }} refreshing={refreshing} contentStyle={{ paddingBottom: 60 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <H1>{t('tab.alerts')}</H1>
          {(data?.unread || 0) > 0 && <Button small kind="secondary" title="Mark all read" onPress={() => post('/alerts/read-all')} />}
        </View>
        <Soft style={{ marginTop: 4 }}>I watch deadlines, renewals and your money every day and tell you what matters.</Soft>

        {brief.data && (
          <Card tone="dark" style={{ marginTop: SP.lg }}>
            <Txt noTr style={{ color: C.mint300, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 }}>{String(brief.data.month || '').toUpperCase()}</Txt>
            <Txt style={{ color: C.white, fontSize: 17, fontWeight: '700', marginTop: 6 }}>Your monthly briefing</Txt>
            {brief.data.score != null && <Small style={{ color: 'rgba(255,255,255,0.8)', marginTop: 6 }}>{`Money Health Score ${brief.data.score}${brief.data.scoreDelta ? ` (${brief.data.scoreDelta > 0 ? '+' : ''}${brief.data.scoreDelta} this month)` : ''}`}</Small>}
            {brief.data.investThisMonth > 0 && <Small style={{ color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>{`You can put about ${inr(brief.data.investThisMonth)} to work this month`}</Small>}
            {brief.data.topAction && <Small noTr style={{ color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>{`→ ${brief.data.topAction.title}`}</Small>}
            {brief.data.nextDeadline && <Small noTr style={{ color: C.gold, marginTop: 4 }}>{`⏰ ${brief.data.nextDeadline.title} · ${prettyDate(brief.data.nextDeadline.due_date)}`}</Small>}
          </Card>
        )}

        <Segmented style={{ marginTop: SP.lg }} value={filter} onChange={setFilter} options={[{ v: 'all', label: 'All' }, { v: 'unread', label: `Unread (${data?.unread || 0})` }]} />
        <View style={{ marginTop: SP.lg, gap: 10 }}>
          {loading && !data ? <Loading /> : error && !data ? <ErrorBox message={error} onRetry={reload} /> : alerts.length === 0 ? (
            <Empty icon="notifications-off-outline" title="All quiet" body="Nothing needs you right now. I’ll tap you when something does." />
          ) : alerts.map((a) => {
            const s = SEV[a.severity] || SEV.info;
            return (
              <Card key={a.id} onPress={() => open(a)} style={a.status === 'unread' ? { borderLeftWidth: 4, borderLeftColor: s.color } : undefined}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: s.bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={s.icon} color={s.color} /></View>
                  <View style={{ flex: 1 }}>
                    <H3 noTr style={{ fontSize: 15.5 }}>{a.title}</H3>
                    <Small noTr style={{ marginTop: 3 }}>{a.body}</Small>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <Chip label={s.label} bg={s.bg} color={s.color} />
                      {a.due_date ? <Tiny noTr>Due {prettyDate(a.due_date)}</Tiny> : null}
                      <View style={{ flex: 1 }} />
                      {a.action_href ? <Txt noTr style={{ color: C.pine700, fontWeight: '700', fontSize: 14 }}>{a.action_label || 'Open'} →</Txt> : null}
                    </View>
                  </View>
                  <Pressable onPress={() => dismiss(a)} hitSlop={10} accessibilityLabel="Dismiss"><Icon name="close" size={18} color={C.inkFaint} /></Pressable>
                </View>
              </Card>
            );
          })}
        </View>
      </Screen>
    </SafeAreaView>
  );
}
