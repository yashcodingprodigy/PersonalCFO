// A connected CA: messages, shared documents (upload from phone or from the vault) and the ITR checklist.
import React, { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useApi } from '@/lib/hooks';
import { api, del, get, post } from '@/lib/api';
import { prettyDate } from '@/lib/format';
import { pickFile, openProtectedFile, TYPES } from '@/lib/files';
import { C, R, SP } from '@/lib/theme';
import { Button, Card, Check, Icon, Label, Screen, Segmented, Sheet, Small, Tiny, Txt, Row } from '@/components/ui';

export default function CaThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<'chat' | 'docs' | 'checklist'>('chat');
  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={{ padding: SP.lg, paddingBottom: 8 }}>
        <Segmented value={tab} onChange={setTab} options={[{ v: 'chat', label: 'Messages' }, { v: 'docs', label: 'Documents' }, { v: 'checklist', label: 'ITR checklist' }]} />
      </View>
      {tab === 'chat' ? <Chat id={String(id)} /> : tab === 'docs' ? <Docs id={String(id)} /> : <Checklist id={String(id)} />}
    </View>
  );
}

function Chat({ id }: { id: string }) {
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const list = useRef<FlatList>(null);
  const load = () => get(`/user/ca/links/${id}/messages`).then((m) => setMsgs(Array.isArray(m) ? m : [])).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [id]);
  useEffect(() => { setTimeout(() => list.current?.scrollToEnd({ animated: true }), 60); }, [msgs.length]);
  async function send() {
    const body = text.trim(); if (!body) return;
    setBusy(true);
    try { const m = await api(`/user/ca/links/${id}/messages`, { method: 'POST', body: { body } }); setMsgs((x) => [...x, m]); setText(''); } catch {} finally { setBusy(false); }
  }
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <FlatList ref={list} data={msgs} keyExtractor={(m) => String(m.message_id)} contentContainerStyle={{ padding: SP.lg, gap: 8, flexGrow: 1 }}
        ListEmptyComponent={<Small style={{ textAlign: 'center', marginTop: 40 }}>No messages yet. Say hello to your CA.</Small>}
        renderItem={({ item: m }) => (
          <View style={{ alignItems: m.sender === 'user' ? 'flex-end' : 'flex-start' }}>
            <View style={{ maxWidth: '85%', borderRadius: 16, padding: 10, backgroundColor: m.sender === 'user' ? C.pine900 : C.white, borderWidth: m.sender === 'user' ? 0 : 1, borderColor: C.paper200 }}>
              <Txt noTr selectable style={{ color: m.sender === 'user' ? C.white : C.ink, fontSize: 15 }}>{m.body}</Txt>
              <Tiny noTr style={{ color: m.sender === 'user' ? 'rgba(255,255,255,0.5)' : C.inkFaint, marginTop: 2 }}>{prettyDate(m.created_at)}</Tiny>
            </View>
          </View>
        )} />
      <View style={{ flexDirection: 'row', gap: 8, padding: SP.md, borderTopWidth: 1, borderTopColor: C.paper200, backgroundColor: C.white }}>
        <TextInput value={text} onChangeText={setText} placeholder="Message your CA…" placeholderTextColor={C.inkFaint} multiline maxLength={2000}
          style={{ flex: 1, minHeight: 44, maxHeight: 110, borderRadius: 22, backgroundColor: C.paper100, paddingHorizontal: 14, paddingTop: 12, fontSize: 16, color: C.ink }} />
        <Pressable onPress={send} disabled={busy || !text.trim()} accessibilityLabel="Send" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: text.trim() ? C.pine900 : C.paper200, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="arrow-up" color={C.white} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Docs({ id }: { id: string }) {
  const docs = useApi<any[]>(`/user/ca/links/${id}/documents`);
  const vault = useApi<any[]>('/documents');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [pickVault, setPickVault] = useState(false);
  async function upload() {
    setErr('');
    try { const f = await pickFile(TYPES.any); if (!f) return; setBusy(true); await post(`/user/ca/links/${id}/documents`, { file_name: f.name, mime_type: f.mime, data: f.base64 }); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  const remove = (d: any) => Alert.alert('Remove this document?', d.file_name, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => del(`/user/ca/links/${id}/documents/${d.document_id}`) }]);
  const vaultFiles = (vault.data || []).filter((v: any) => v.file_name);
  return (
    <Screen onRefresh={docs.reload} refreshing={docs.refreshing}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button small title="Upload from phone" icon="cloud-upload-outline" onPress={upload} loading={busy} />
        <Button small kind="secondary" title="From my vault" icon="lock-closed-outline" onPress={() => setPickVault(true)} />
      </View>
      {err ? <Small style={{ color: C.red, marginTop: 8 }}>{err}</Small> : null}
      <Card style={{ marginTop: SP.lg, paddingVertical: 4 }}>
        {(docs.data || []).length === 0 ? <Small style={{ paddingVertical: 12 }}>No shared documents yet.</Small> : (docs.data || []).map((d: any, i: number, a: any[]) => (
          <Row key={d.document_id} icon="document-text-outline" noTr title={d.file_name} subtitle={`${d.uploaded_by === 'user' ? 'You' : 'Your CA'} · ${prettyDate(d.created_at)}`} last={i === a.length - 1}
            onPress={() => openProtectedFile(`/user/ca/links/${id}/documents/${d.document_id}/file`, d.file_name).catch((e) => setErr(e.message))}
            right={<Pressable onPress={() => remove(d)} hitSlop={8}><Icon name="trash-outline" size={18} color={C.inkFaint} /></Pressable>} />
        ))}
      </Card>
      <Sheet visible={pickVault} onClose={() => setPickVault(false)} title="Share from your vault">
        {vaultFiles.length === 0 ? <Small>Your vault has no files yet.</Small> : vaultFiles.map((v: any) => (
          <Row key={v.id} icon="lock-closed-outline" noTr title={v.file_name} subtitle={v.label} onPress={async () => { setPickVault(false); try { await post(`/user/ca/links/${id}/documents/from-vault`, { vault_id: v.id }); } catch (e: any) { setErr(e.message); } }} />
        ))}
      </Sheet>
    </Screen>
  );
}

function Checklist({ id }: { id: string }) {
  const { data, reload, refreshing } = useApi<any>(`/user/ca/links/${id}/checklist`);
  const state = data?.state || {};
  return (
    <Screen onRefresh={reload} refreshing={refreshing}>
      <Small>Tick each document once you’ve sent it to your CA — they see the same list.</Small>
      <View style={{ gap: 10, marginTop: SP.md }}>
        {(data?.documents || []).map((d: any) => (
          <Card key={d.key}>
            <Check checked={!!state[d.key]?.sent} onChange={(v) => api(`/user/ca/links/${id}/checklist`, { method: 'PATCH', body: { key: d.key, sent: v } }).then(reload).catch(() => {})}>
              <Txt style={{ fontWeight: '700' }}>{d.name}</Txt>
              <Tiny>{`From: ${d.who}`}</Tiny>
              <Small style={{ marginTop: 4 }}>{d.how}</Small>
              {state[d.key]?.received ? <Small style={{ color: C.green, marginTop: 4 }}>✓ Your CA marked this received</Small> : null}
            </Check>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
