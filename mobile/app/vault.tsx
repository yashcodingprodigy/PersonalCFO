// Document vault — encrypted copies of what matters (ID, tax, money, property, personal), several files
// per slot, with optional expiry dates that feed renewal reminders.
import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useApi } from '@/lib/hooks';
import { del, post } from '@/lib/api';
import { prettyDate } from '@/lib/format';
import { pickFile, openProtectedFile, TYPES } from '@/lib/files';
import { C, SP } from '@/lib/theme';
import { Button, Card, Disclaimer, Input, Label, Loading, Screen, Sheet, Small, Soft, Tiny, Txt, Icon } from '@/components/ui';

const GROUPS: { title: string; slots: string[] }[] = [
  { title: 'Identity', slots: ['pan', 'aadhaar', 'passport', 'driving_license', 'voter_id'] },
  { title: 'Tax & income', slots: ['form16', 'form26as_ais', 'salary_slips', 'capital_gains', 'investment_proofs', 'rent_receipts', 'loan_certificate'] },
  { title: 'Money & banking', slots: ['bank_statement', 'insurance_policy', 'nomination', 'demat_holdings'] },
  { title: 'Property & assets', slots: ['property_papers', 'vehicle_rc'] },
  { title: 'Personal records', slots: ['birth_certificate', 'marriage_certificate', 'degree_certificates', 'medical_records', 'will_estate', 'other'] },
];

export default function Vault() {
  const slots = useApi<any[]>('/documents/slots');
  const docs = useApi<any[]>('/documents');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [expirySlot, setExpirySlot] = useState<any>(null);
  const [expiry, setExpiry] = useState('');
  const label = (s: string) => (slots.data || []).find((x: any) => x.slot === s)?.label || s;
  const inSlot = (s: string) => (docs.data || []).filter((d: any) => d.slot === s);

  async function add(slot: string, expiry_date?: string) {
    setErr('');
    try {
      const f = await pickFile(TYPES.any);
      if (!f) return;
      setBusy(slot);
      const row: any = await post('/documents', { slot, label: label(slot), status: 'have', expiry_date: expiry_date || null, note: f.name });
      await post(`/documents/${row.id}/file`, { file_name: f.name, mime_type: f.mime, data: f.base64 });
    } catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  }
  const remove = (d: any) => Alert.alert('Remove this file?', d.file_name || d.note || d.label, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => del(`/documents/${d.id}`).catch((e) => setErr(e.message)) }]);

  if (docs.loading && !docs.data) return <Screen><Loading /></Screen>;
  return (
    <Screen onRefresh={() => { docs.reload(); slots.reload(); }} refreshing={docs.refreshing}>
      <Soft>Encrypted copies of your important documents — always with you, and shareable with your CA. Add an expiry date and I’ll remind you before it runs out.</Soft>
      {err ? <Card style={{ marginTop: 10, backgroundColor: '#F8E3DF' }}><Small style={{ color: C.red }}>{err}</Small></Card> : null}
      {GROUPS.map((g) => (
        <View key={g.title} style={{ marginTop: SP.xl }}>
          <Label style={{ marginBottom: 8 }}>{g.title}</Label>
          <Card style={{ paddingVertical: 4 }}>
            {g.slots.map((s, i) => {
              const items = inSlot(s);
              return (
                <View key={s} style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: C.paper100 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Icon name={items.length ? 'document-text' : 'document-outline'} color={items.length ? C.pine700 : C.inkFaint} />
                    <Txt style={{ flex: 1, fontWeight: '600' }}>{label(s)}</Txt>
                    <Pressable onPress={() => { setExpirySlot(s); setExpiry(''); }} hitSlop={8} accessibilityLabel={`Add to ${label(s)}`} disabled={busy === s}>
                      <Icon name={busy === s ? 'hourglass-outline' : 'add-circle'} size={26} color={C.pine700} />
                    </Pressable>
                  </View>
                  {items.map((d: any) => (
                    <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, marginLeft: 34 }}>
                      <Pressable style={{ flex: 1 }} onPress={() => (d.has_file || d.file_name || d.storage_path) ? openProtectedFile(`/documents/${d.id}/file`, d.file_name || d.note || 'document').catch((e) => setErr(e.message)) : undefined}>
                        <Small noTr numberOfLines={1} style={{ color: C.pine700 }}>{d.file_name || d.note || 'File'}</Small>
                        {d.expiry_date ? <Tiny noTr>{`Expires ${prettyDate(d.expiry_date)}`}</Tiny> : null}
                      </Pressable>
                      <Pressable onPress={() => remove(d)} hitSlop={8}><Icon name="trash-outline" size={18} color={C.inkFaint} /></Pressable>
                    </View>
                  ))}
                </View>
              );
            })}
          </Card>
        </View>
      ))}
      <Disclaimer>Files are encrypted (AES-256) before storage and only you — and a CA you connect — can open them.</Disclaimer>
      <Sheet visible={!!expirySlot} onClose={() => setExpirySlot(null)} title={expirySlot ? label(expirySlot) : ''}>
        <Input label="Expiry or renewal date (optional)" value={expiry} onChangeText={setExpiry} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" hint="For passports, licences, policies — I’ll remind you before it lapses." />
        <Button title="Choose file" icon="cloud-upload-outline" onPress={() => { const s = expirySlot; const e = /^\d{4}-\d{2}-\d{2}$/.test(expiry) ? expiry : undefined; setExpirySlot(null); setTimeout(() => add(s, e), 500); }} />
      </Sheet>
    </Screen>
  );
}
