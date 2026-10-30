// File your ITR yourself — a beginner, step-by-step guide personalised with your computed form, regime and refund.
import React from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { useApi } from '@/lib/hooks';
import { inr } from '@/lib/format';
import { C, FONT, R, SP } from '@/lib/theme';
import { Bullets, Button, Card, Chip, Disclaimer, Num, Screen, Small, Soft, Tiny, Txt, H3 } from '@/components/ui';

const FORMS = [
  { code: 'ITR-1', name: 'Sahaj', who: 'Most salaried people: salary/pension, one house, interest income, total income under ₹50 lakh. No capital gains.' },
  { code: 'ITR-2', name: 'ITR-2', who: 'You sold shares, funds or property, own more than one house, earn over ₹50 lakh, or have foreign assets — but no business income.' },
  { code: 'ITR-3', name: 'ITR-3', who: 'You run a business or profession and keep regular books (not presumptive).' },
  { code: 'ITR-4', name: 'Sugam', who: 'Small business or freelancer on the presumptive scheme (44AD/44ADA), income under ₹50 lakh.' },
];

export default function FileSelf() {
  const { data: f } = useApi<any>('/tax/full');
  const fy = f?.fy || '';
  const ay = fy ? `${Number(fy.slice(0, 4)) + 1}-${String(Number(fy.slice(0, 4)) + 2).slice(2)}` : '';
  const rec = f ? (f.recommendedRegime === 'old' ? f.old : f.new) : null;
  const refund = rec?.refundOrPayable ?? 0;
  const portal = () => Linking.openURL('https://www.incometax.gov.in');
  const steps: { t: string; b: string; extra?: React.ReactNode }[] = [
    { t: 'Gather your documents', b: 'Keep handy: PAN & Aadhaar, Form 16, Form 26AS & AIS, bank-interest certificate, capital-gains statement, and proofs for deductions. Monthly records in PayWatch collects them in one place.', extra: <Button small kind="secondary" title="Open Monthly records" onPress={() => router.push('/records')} style={{ alignSelf: 'flex-start', marginTop: 8 }} /> },
    { t: 'Download your AIS and Form 26AS', b: 'They’re the tax department’s own record of your income and TDS. On incometax.gov.in: log in → Services → AIS. File so your return matches these.' },
    { t: 'Know which ITR form is yours', b: `Based on your data you’ll likely file ${f?.form?.code || 'ITR-1 or ITR-2'}.`, extra: <View style={{ gap: 8, marginTop: 8 }}>{FORMS.map((x) => (
      <View key={x.code} style={{ borderRadius: R.md, borderWidth: 1, borderColor: f?.form?.code === x.code ? C.mint500 : C.paper200, backgroundColor: f?.form?.code === x.code ? C.mint100 : C.white, padding: 10 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Txt noTr style={{ fontWeight: '700' }}>{`${x.code} · ${x.name}`}</Txt>{f?.form?.code === x.code && <Chip label="Yours" />}</View>
        <Small>{x.who}</Small>
      </View>))}</View> },
    { t: 'Log in to the income-tax portal', b: 'Go to incometax.gov.in and log in with your PAN as the user ID. First time? Register with PAN and Aadhaar OTP.', extra: <Button small kind="secondary" title="Open incometax.gov.in" icon="open-outline" onPress={portal} style={{ alignSelf: 'flex-start', marginTop: 8 }} /> },
    { t: 'Start the return', b: `e-File → Income Tax Returns → File Income Tax Return. Choose assessment year ${ay || '(this year)'}, Online mode, and ${f?.form?.code || 'your form'}.` },
    { t: 'Check the pre-filled data', b: `Most of it is pre-filled from AIS. Cross-check every figure against your documents and the PayWatch computation. The final figure should be close to ${rec ? `${refund >= 0 ? 'a refund of ' : 'tax payable of '}${inr(Math.abs(refund))}` : 'your computed figure'}.` },
    { t: 'Pay any tax due (or claim your refund)', b: 'If tax is payable, pay via e-Pay Tax (net-banking/UPI) and add the challan. For a refund, make sure your bank account is pre-validated on the portal.' },
    { t: 'Submit and e-verify', b: 'Submit, then e-verify within 30 days — Aadhaar OTP is easiest. An unverified return is treated as not filed.' },
  ];
  return (
    <Screen>
      <Soft>{`A simple guide to filing your own return on the government portal${fy ? ` — FY ${fy} (AY ${ay})` : ''}.`}</Soft>
      {f && (
        <Card tone="dark" style={{ marginTop: SP.lg }}>
          <Txt style={{ color: C.mint300, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 }}>BASED ON YOUR DATA</Txt>
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
            <View><Tiny style={{ color: 'rgba(255,255,255,0.5)' }}>FORM</Tiny><Txt noTr style={{ color: C.white, fontFamily: FONT.display, fontSize: 20 }}>{f.form.code}</Txt></View>
            <View><Tiny style={{ color: 'rgba(255,255,255,0.5)' }}>REGIME</Tiny><Txt noTr style={{ color: C.white, fontFamily: FONT.display, fontSize: 20, textTransform: 'capitalize' }}>{f.recommendedRegime}</Txt></View>
            <View><Tiny style={{ color: 'rgba(255,255,255,0.5)' }}>{refund >= 0 ? 'REFUND' : 'PAYABLE'}</Tiny><Num style={{ color: C.mint300, fontFamily: FONT.display, fontSize: 20 }}>{inr(Math.abs(refund))}</Num></View>
          </View>
        </Card>
      )}
      <Card style={{ marginTop: SP.lg }}>
        {steps.map((s, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 12, paddingBottom: 18 }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.pine900, alignItems: 'center', justifyContent: 'center' }}><Num style={{ color: C.white, fontWeight: '700' }}>{i + 1}</Num></View>
            <View style={{ flex: 1 }}><H3 style={{ fontSize: 15.5 }}>{s.t}</H3><Small style={{ marginTop: 4 }}>{s.b}</Small>{s.extra}</View>
          </View>
        ))}
        <Small style={{ color: C.green, fontWeight: '700' }}>✓ That’s it — keep the ITR-V and your documents safe for a few years.</Small>
      </Card>
      <Card style={{ marginTop: SP.lg, borderLeftWidth: 4, borderLeftColor: C.amber }}>
        <Txt style={{ color: C.amber, fontWeight: '700', marginBottom: 8 }}>Avoid these slip-ups</Txt>
        <Bullets mark="✕" color={C.amber} items={['Forgetting to e-verify — an unverified return counts as not filed.', 'Not reporting savings/FD interest or small capital gains — they’re in your AIS.', 'Picking a regime without comparing — check the Tax screen first.', 'Missing the 31 July deadline — penalty and lost loss carry-forward.']} />
      </Card>
      {f?.needsCA?.required && <Card style={{ marginTop: SP.md, borderLeftWidth: 4, borderLeftColor: C.red }}><Small>{f.needsCA.reason}</Small></Card>}
      <Disclaimer>Educational guide. PayWatch helps you prepare and self-file; where an audit or certification is required, a Chartered Accountant must sign.</Disclaimer>
    </Screen>
  );
}
