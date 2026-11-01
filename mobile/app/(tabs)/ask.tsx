// Ask PayWatch — chat with your money brain. Shares one conversation with voice mode,
// and acts on what you ask (opens screens, pins a guide, updates dreams, switches language).
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, get, notifyDataChanged, ask as askPost } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { useAssistant } from '@/lib/assistant';
import { C, FONT, R, SP } from '@/lib/theme';
import { Button, Icon, Orb, Select, Small, Tiny, Txt, Soft } from '@/components/ui';
import { Markdown } from '@/components/Markdown';

const SUGGEST = {
  en: ['Can I afford a ₹80,000 laptop?', 'I want to go to Goa in December', 'How much tax will I pay this year?', 'Show me health insurance options'],
  hi: ['क्या मैं ₹80,000 का लैपटॉप ले सकता हूँ?', 'मुझे दिसंबर में गोवा जाना है', 'इस साल मेरा टैक्स कितना बनेगा?', 'मुझे हेल्थ इंश्योरेंस दिखाओ'],
};

export default function Ask() {
  const { lang, t } = useLang();
  const { convId, setConvId, runActions, openVoice, newChat, chatKey } = useAssistant();
  const params = useLocalSearchParams<{ q?: string; t?: string }>();
  const [messages, setMessages] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [disclaimer, setDisclaimer] = useState('');
  const listRef = useRef<FlatList>(null);
  const lastQ = useRef<string | undefined>(undefined);

  useEffect(() => { get('/qa/disclaimer').then((d) => setDisclaimer(d.disclaimer)).catch(() => {}); }, []);
  const loadConvs = () => get('/qa/conversations').then((r) => setConversations(Array.isArray(r) ? r : [])).catch(() => {});
  useEffect(() => { loadConvs(); }, []);
  // Resume the shared conversation (e.g. after voice) or start fresh.
  useEffect(() => {
    if (convId) get(`/qa/conversations/${convId}`).then((c) => setMessages(c.messages || [])).catch(() => {});
    else setMessages([]);
  }, [convId, chatKey]);
  // A question handed over from elsewhere (Home "Can I afford…", a dream card…)
  useEffect(() => { if (params.q && params.t !== lastQ.current) { lastQ.current = params.t; send(params.q); } }, [params.q, params.t]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setBusy(true); setErr(''); setInput('');
    setMessages((m) => [...m, { message_id: `tmp_${Date.now()}`, role: 'user', content }]);
    try {
      const body = { content, lang, mode: 'chat' };
      const res: any = convId ? await askPost(`/qa/conversations/${convId}/messages`, body, 60000) : await askPost('/qa/conversations', body, 60000);
      if (!convId && res.conversation_id) { setConvId(res.conversation_id); loadConvs(); }
      setMessages((m) => [...m, { ...res.message, proposedAction: res.proposedAction }]);
      if (/✨|✅/.test(res.message?.content || '')) notifyDataChanged();
      if (res.actions?.length) runActions(res.actions);
    } catch (e: any) {
      setErr(e.message); setMessages((m) => m.slice(0, -1)); setInput(content);
    } finally { setBusy(false); }
  }
  async function confirmProposed(mid: string, benefit: any) {
    try { await api('/context/benefits', { method: 'POST', body: benefit }); notifyDataChanged(); setMessages((ms) => ms.map((x) => (x.message_id === mid ? { ...x, _state: 'added' } : x))); }
    catch (e: any) { setErr(e.message); }
  }

  function clearChat() {
    if (!messages.length && !convId) return;
    const hi = lang === 'hi';
    const clearOne = async () => {
      try { if (convId) await api(`/qa/conversations/${convId}`, { method: 'DELETE' }); } catch {}
      setMessages([]); newChat(); loadConvs();
    };
    const clearAll = async () => {
      try { await api('/qa/conversations', { method: 'DELETE' }); } catch {}
      setMessages([]); setConversations([]); newChat();
    };
    Alert.alert(hi ? 'चैट साफ़ करें?' : 'Clear chat?', hi ? 'यह बातचीत हमेशा के लिए हट जाएगी।' : 'This conversation will be permanently deleted.', [
      { text: hi ? 'रद्द करें' : 'Cancel', style: 'cancel' },
      ...(conversations.length > 1 ? [{ text: hi ? 'सारी चैट हटाएँ' : 'Clear all chats', style: 'destructive' as const, onPress: clearAll }] : []),
      { text: hi ? 'साफ़ करें' : 'Clear', style: 'destructive' as const, onPress: clearOne },
    ]);
  }

  useEffect(() => { setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80); }, [messages.length, busy]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.lg, paddingVertical: 8, gap: 10 }}>
        <Orb size={28} />
        <Txt style={{ fontFamily: FONT.display, fontSize: 22, flex: 1 }} noTr>{t('as.title')}</Txt>
        {messages.length > 0 && <Pressable onPress={clearChat} hitSlop={8} accessibilityLabel={lang === 'hi' ? 'चैट साफ़ करें' : 'Clear chat'} style={iconBtn}><Icon name="trash-outline" size={20} color={C.inkSoft} /></Pressable>}
        <Pressable onPress={newChat} hitSlop={8} accessibilityLabel={t('as.newChat')} style={iconBtn}><Icon name="add" size={22} color={C.inkSoft} /></Pressable>
        <Pressable onPress={openVoice} hitSlop={8} accessibilityLabel={t('as.voice')} style={[iconBtn, { backgroundColor: C.pine900 }]}><Icon name="mic" size={20} color={C.white} /></Pressable>
      </View>
      {conversations.length > 0 && (
        <View style={{ paddingHorizontal: SP.lg }}>
          <Select value={convId || ''} onChange={(v) => (v ? setConvId(v) : newChat())} placeholder="+ New conversation"
            options={[{ v: '', label: '+ New conversation' }, ...conversations.map((c) => ({ v: String(c.conversation_id), label: c.title || 'Conversation' }))]} />
        </View>
      )}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => String(m.message_id)}
          contentContainerStyle={{ padding: SP.lg, gap: 12, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 30 }}>
              <Orb size={80} />
              <Soft style={{ textAlign: 'center', marginTop: 12, marginBottom: 16 }}>Ask anything about your money — or tell me a dream and I’ll plan it.</Soft>
              {SUGGEST[lang].map((s) => (
                <Pressable key={s} onPress={() => send(s)} style={({ pressed }) => [{ width: '100%', borderRadius: R.md, borderWidth: 1, borderColor: C.paper200, backgroundColor: pressed ? C.paper100 : C.paper50, padding: 12, marginBottom: 8 }]}>
                  <Txt noTr style={{ fontSize: 14.5 }}>{s}</Txt>
                </Pressable>
              ))}
            </View>
          }
          renderItem={({ item: m }) => (
            <View style={{ alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <View style={{ maxWidth: '88%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
                backgroundColor: m.role === 'user' ? C.pine900 : C.white, borderWidth: m.role === 'user' ? 0 : 1, borderColor: C.paper200,
                borderBottomRightRadius: m.role === 'user' ? 6 : 18, borderBottomLeftRadius: m.role === 'user' ? 18 : 6 }}>
                {m.role === 'user' ? <Txt noTr selectable style={{ color: C.white, fontSize: 15.5 }}>{m.content}</Txt> : <Markdown text={m.content} />}
                {m.role === 'assistant' && m.proposedAction && m._state !== 'dismissed' && (
                  <View style={{ marginTop: 10, borderRadius: 12, backgroundColor: C.mint100, padding: 10 }}>
                    {m._state === 'added' ? <Small style={{ color: C.pine800, fontWeight: '700' }}>✓ Added to your profile.</Small> : <>
                      <Small noTr>{m.proposedAction.summary}</Small>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                        <Button small title="Yes, add it" onPress={() => confirmProposed(m.message_id, m.proposedAction.benefit)} />
                        <Button small kind="secondary" title="No thanks" onPress={() => setMessages((ms) => ms.map((x) => (x.message_id === m.message_id ? { ...x, _state: 'dismissed' } : x)))} />
                      </View>
                    </>}
                  </View>
                )}
              </View>
            </View>
          )}
          ListFooterComponent={busy ? <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingTop: 4 }}><ActivityIndicator color={C.mint500} /><Small>{t('vo.thinking')}</Small></View> : undefined}
        />
        {err ? <Small style={{ color: C.red, paddingHorizontal: SP.lg, paddingBottom: 6 }}>{err}</Small> : null}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: SP.md, paddingTop: 8, paddingBottom: 10, borderTopWidth: 1, borderTopColor: C.paper200, backgroundColor: C.white }}>
          <TextInput value={input} onChangeText={setInput} placeholder={t('as.placeholder')} placeholderTextColor={C.inkFaint} multiline maxLength={2000}
            style={{ flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, backgroundColor: C.paper100, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 16, color: C.ink }}
            accessibilityLabel={t('as.placeholder')} />
          <Pressable onPress={() => send()} disabled={busy || !input.trim()} accessibilityRole="button" accessibilityLabel="Send"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: input.trim() ? C.pine900 : C.paper200, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="arrow-up" color={C.white} size={22} />
          </Pressable>
        </View>
        <Tiny style={{ paddingHorizontal: SP.lg, paddingBottom: 6, backgroundColor: C.white }} numberOfLines={2}>{disclaimer || 'Educational guidance, not investment advice.'}</Tiny>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const iconBtn = { width: 40, height: 40, borderRadius: 20, backgroundColor: C.paper100, alignItems: 'center' as const, justifyContent: 'center' as const };
