// Your CA — connect YOUR OWN Chartered Accountant with a code handshake (a private tool, not a marketplace).
import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useApi } from '@/lib/hooks';
import { del, post } from '@/lib/api';
import { C, FONT, SP } from '@/lib/theme';
import { Button, Card, Chip, Disclaimer, Input, Label, Loading, Screen, Small, Soft, Tiny, Txt, H3 } from '@/components/ui';

export default function CaHome() {
  const { data, loading, reload, refreshing } = useApi<{ connect_code: string; links: any[] }>('/user/ca');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  if (loading && !data) return <Screen><Loading /></Screen>;
  const links = data?.links || [];

  async function connect() {
    setBusy(true); setErr(''); setMsg('');
    try { const r: any = await post('/user/ca/connect', { code: code.trim() }); setCode(''); setMsg(r?.status === 'active' ? 'Connected!' : 'Request sent — your CA needs to approve it.'); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  const disconnect = (l: any) => Alert.alert('Disconnect this CA?', 'They will no longer see your documents or messages.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Disconnect', style: 'destructive', onPress: () => del(`/user/ca/links/${l.link_id}`) }]);

  return (
    <Screen onRefresh={reload} refreshing={refreshing}>
      <Soft>Work with your own Chartered Accountant inside PayWatch: share documents securely, chat, and give them your computed tax pack. PayWatch prepares — your CA reviews and files.</Soft>
      <Card tone="dark" style={{ marginTop: SP.lg }}>
        <Txt style={{ color: C.mint300, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 }}>YOUR CONNECT CODE</Txt>
        <Txt noTr selectable style={{ color: C.white, fontFamily: FONT.display, fontSize: 30, marginTop: 6, letterSpacing: 2 }}>{data?.connect_code || '—'}</Txt>
        <Small style={{ color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>Give this to your CA — they enter it in their PayWatch CA portal, and you approve.</Small>
        <Button kind="light" small title="Copy code" icon="copy-outline" style={{ marginTop: 12, alignSelf: 'flex-start' }}
          onPress={async () => { if (data?.connect_code) { await Clipboard.setStringAsync(data.connect_code); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); setMsg('Code copied.'); } }} />
      </Card>
      <Card style={{ marginTop: 12 }}>
        <Input label="Or enter your CA’s code" value={code} onChangeText={(s) => setCode(s.toUpperCase())} placeholder="CA-XXXXXX" autoCapitalize="none" />
        <Button title="Connect" onPress={connect} loading={busy} disabled={code.trim().length < 3} />
        {msg ? <Small style={{ color: C.green, marginTop: 8 }}>{msg}</Small> : null}
        {err ? <Small style={{ color: C.red, marginTop: 8 }}>{err}</Small> : null}
      </Card>
      {links.length > 0 && <Label style={{ marginTop: SP.xl, marginBottom: 8 }}>Your CAs</Label>}
      <View style={{ gap: 10 }}>
        {links.map((l: any) => (
          <Card key={l.link_id} onPress={l.status === 'active' ? () => router.push(`/ca/${l.link_id}`) : undefined}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1 }}><H3 noTr>{l.ca_name}</H3><Tiny noTr>{[l.firm_name, l.city, l.icai_number ? `ICAI ${l.icai_number}` : ''].filter(Boolean).join(' · ')}</Tiny></View>
              <Chip label={l.status === 'active' ? 'Connected' : l.initiated_by === 'ca' ? 'Wants to connect' : 'Awaiting CA'} bg={l.status === 'active' ? C.mint100 : '#FBF0DF'} color={l.status === 'active' ? C.pine800 : C.amber} />
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              {l.status === 'active' && <Button small title="Open" onPress={() => router.push(`/ca/${l.link_id}`)} />}
              {l.status === 'pending' && l.initiated_by === 'ca' && <Button small title="Approve" onPress={() => post(`/user/ca/links/${l.link_id}/approve`)} />}
              {l.status === 'pending' && l.initiated_by === 'ca'
                ? <Button small kind="secondary" title="Decline" onPress={() => post(`/user/ca/links/${l.link_id}/reject`)} />
                : <Button small kind="danger" title={l.status === 'active' ? 'Disconnect' : 'Cancel request'} onPress={() => disconnect(l)} />}
            </View>
          </Card>
        ))}
      </View>
      <Disclaimer>PayWatch doesn’t list, recommend or rank CAs, and takes no fee from them. You connect the CA you already work with.</Disclaimer>
    </Screen>
  );
}
