// Plans — what each plan includes and which one you're on. Store rule: digital subscriptions are not
// sold inside the iOS/Android app (no purchase buttons or links); paid features unlock if the account has a plan.
import React from 'react';
import { View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { C, FONT, SP } from '@/lib/theme';
import { Bullets, Card, Chip, Disclaimer, Screen, Soft, Txt, H3, Small } from '@/components/ui';

const PLANS = [
  { key: 'free', name: 'Free', tag: 'Start here', feats: ['Your Money Health Score', 'The top few actions to fix first', 'Net-worth & spending snapshot', 'A taste of Ask PayWatch'] },
  { key: 'starter', name: 'Starter', tag: 'Get organised', feats: ['Full Money Health Score', 'Personalised investing plan (fund categories)', 'Bank statement scan & spending breakdown', '3 actions per month · 2 dreams', 'Basic tax view · data export'] },
  { key: 'cfo', name: 'CFO', tag: 'Your always-on money brain', feats: ['Everything in Starter, unlimited', 'Proactive alerts + monthly briefing', 'Year-round Tax Copilot & CA-ready pack', 'Spending watchdog & dream autopilot', 'Document vault with renewal reminders', 'Unlimited Ask PayWatch, chat & voice'] },
];

export default function Plans() {
  const { me } = useAuth();
  const current = me?.plan_status === 'active' ? me?.plan || 'free' : 'free';
  return (
    <Screen>
      <Soft>Here’s what each plan includes. Your current plan is highlighted.</Soft>
      <View style={{ gap: 12, marginTop: SP.lg }}>
        {PLANS.map((p) => (
          <Card key={p.key} style={current === p.key ? { borderWidth: 2, borderColor: C.pine700 } : undefined}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Txt noTr style={{ fontFamily: FONT.display, fontSize: 22 }}>{p.name}</Txt>
              {current === p.key && <Chip label="Your plan" />}
            </View>
            <Small style={{ marginBottom: 10 }}>{p.tag}</Small>
            <Bullets items={p.feats} mark="✓" />
          </Card>
        ))}
      </View>
      <Card tone="paper" style={{ marginTop: SP.lg }}><H3 style={{ fontSize: 15 }}>Changing plans</H3><Small style={{ marginTop: 4 }}>Plan changes aren’t available in the app. Everything included in your current plan works here.</Small></Card>
      <Disclaimer>PayWatch is a financial education, organisation and tax-preparation tool — not investment, insurance or CA advice.</Disclaimer>
    </Screen>
  );
}
