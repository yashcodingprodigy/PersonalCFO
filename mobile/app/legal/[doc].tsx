// Legal pages — the full Terms / Privacy Policy / Disclosures live on paywatch.in and open in an in-app browser.
import React, { useEffect } from 'react';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { WEB_URL } from '@/lib/api';
import { Button, Card, Screen, Soft, H3 } from '@/components/ui';

const TITLES: Record<string, string> = { terms: 'Terms of use', privacy: 'Privacy policy', disclosures: 'Disclosures' };
const SUMMARY: Record<string, string> = {
  terms: 'PayWatch is a financial education, organisation and tax-preparation tool. It does not give SEBI-registered investment advice, sell insurance itself, or replace a Chartered Accountant.',
  privacy: 'Your data is used only to run PayWatch for you. Documents are encrypted, data is stored in India, we never sell it, and you can export or delete everything from Settings at any time.',
  disclosures: 'Investment guidance is at asset-class / fund-category level only. Insurance is arranged through an IRDAI-licensed partner. Projections are illustrations, not guarantees.',
};

export default function Legal() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const key = TITLES[String(doc)] ? String(doc) : 'terms';
  const open = () => WebBrowser.openBrowserAsync(`${WEB_URL}/legal/${key}`).catch(() => {});
  useEffect(() => { open(); }, [key]);
  return (
    <Screen>
      <Stack.Screen options={{ title: TITLES[key] }} />
      <Card>
        <H3>{TITLES[key]}</H3>
        <Soft style={{ marginTop: 8 }}>{SUMMARY[key]}</Soft>
        <Button title="Read the full document" icon="open-outline" style={{ marginTop: 16 }} onPress={open} />
        <Button kind="ghost" title="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </Card>
    </Screen>
  );
}
