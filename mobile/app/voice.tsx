// Hands-free voice with the money brain: tap once → it listens, notices when you stop,
// thinks, answers out loud in a natural voice, then listens again. Tap the orb to interrupt.
import React, { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAudioRecorder } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { ask, notifyDataChanged } from '@/lib/api';
import { useLang, TKey } from '@/lib/i18n';
import { useAssistant } from '@/lib/assistant';
import { listen, speak, stopSpeaking, cleanForSpeech, voiceStatus, RECORDING, ListenHandle, ListenError, VoiceLang } from '@/lib/voice';
import { C, SP } from '@/lib/theme';
import { Icon, Orb, Txt, Small, Button } from '@/components/ui';

type Phase = 'idle' | 'starting' | 'listening' | 'thinking' | 'speaking';
const ERR: Record<ListenError, TKey> = { denied: 'vo.denied', 'no-mic': 'vo.denied', unsupported: 'vo.didntCatch', 'no-speech': 'vo.didntCatch', 'stt-failed': 'vo.didntCatch', network: 'vo.didntCatch' };

export default function Voice() {
  const { lang, setLang, t } = useLang();
  const { convId, setConvId, runActions, setGuide } = useAssistant();
  const recorder = useAudioRecorder(RECORDING);
  const [phase, setPhase] = useState<Phase>('idle');
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState('');
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const [denied, setDenied] = useState(false);
  const [human, setHuman] = useState(false);
  const conv = useRef<string | null>(convId);
  const handle = useRef<ListenHandle | null>(null);
  const alive = useRef(true);
  const phaseRef = useRef<Phase>('idle');
  const scroll = useRef<any>(null);
  const contentH = useRef(0);
  const setP = (p: Phase) => { phaseRef.current = p; setPhase(p); };

  useEffect(() => {
    alive.current = true;
    voiceStatus().then((s) => setHuman((lang === 'hi' ? s.ttsHi : s.tts) !== 'browser'));
    const t0 = setTimeout(turn, 350);
    return () => { alive.current = false; clearTimeout(t0); handle.current?.cancel(); stopSpeaking(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => { alive.current = false; handle.current?.cancel(); stopSpeaking(); if (router.canGoBack()) router.back(); else router.replace('/'); };

  async function turn() {
    if (!alive.current) return;
    setNote(''); setHeard(''); setDenied(false); setP('starting');
    const h = listen(recorder, lang as VoiceLang, {
      onLevel: setLevel, onPartial: setHeard,
      onReady: () => { if (alive.current) { setP('listening'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); } },
    });
    handle.current = h;
    const { text, language, error } = await h.result;
    handle.current = null;
    if (!alive.current) return;
    if (!text) { setP('idle'); if (error === 'denied') setDenied(true); setNote(t(ERR[error || 'no-speech'])); return; }
    setHeard(text); setReply(''); setP('thinking');
    const replyLang: VoiceLang = language === 'hi' || /[ऀ-ॿ]/.test(text) ? 'hi' : language === 'en' ? 'en' : (lang as VoiceLang);
    try {
      const body = { content: text, lang: replyLang, mode: 'voice' };
      const res: any = conv.current ? await ask(`/qa/conversations/${conv.current}/messages`, body, 60000) : await ask('/qa/conversations', body, 60000);
      if (res.conversation_id && res.conversation_id !== conv.current) { conv.current = res.conversation_id; setConvId(res.conversation_id); }
      const answer: string = res.message?.content || '';
      if (/✨|✅/.test(answer)) notifyDataChanged();
      const navActions = (res.actions || []).filter((a: any) => a.type === 'navigate');
      const otherActions = (res.actions || []).filter((a: any) => a.type !== 'navigate');
      if (otherActions.length) runActions(otherActions);
      if (!alive.current) return;
      setReply(cleanForSpeech(answer)); setP('speaking');
      await speak(answer, replyLang, (r) => {
        const max = contentH.current - 220; if (max > 0) scroll.current?.scrollTo({ y: Math.max(0, max * r - 40), animated: true });
      });
      if (!alive.current) return;
      if (navActions.length) { alive.current = false; router.back(); setTimeout(() => runActions([...navActions, ...otherActions.filter((a: any) => a.type === 'guide')]), 250); return; }
      if (phaseRef.current === 'speaking') turn();
    } catch (e: any) { setP('idle'); setNote(e.message || 'Something went wrong.'); }
  }

  function tapOrb() {
    if (phase === 'listening' || phase === 'starting') { handle.current?.stop(); return; }
    if (phase === 'speaking') { stopSpeaking(); setP('idle'); setTimeout(turn, 150); return; }
    if (phase === 'idle') turn();
  }
  const label = phase === 'starting' ? t('vo.starting') : phase === 'listening' ? t('vo.listening') : phase === 'thinking' ? t('vo.thinking') : phase === 'speaking' ? t('vo.speaking') : t('vo.tapToTalk');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.pine950 }}>
      <StatusBar style="light" />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.lg, paddingTop: 6 }}>
        <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, padding: 3 }}>
          {(['en', 'hi'] as const).map((l) => (
            <Pressable key={l} onPress={() => setLang(l)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: lang === l ? C.white : 'transparent' }} accessibilityRole="button">
              <Txt noTr style={{ fontSize: 13, fontWeight: '700', color: lang === l ? C.pine950 : 'rgba(255,255,255,0.7)' }}>{l === 'en' ? 'English' : 'हिंदी'}</Txt>
            </Pressable>
          ))}
        </View>
        <Small noTr style={{ color: 'rgba(255,255,255,0.45)' }}>{human ? t('vo.human') : t('vo.device')}</Small>
        <Pressable onPress={close} accessibilityLabel={t('common.close')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" color={C.white} size={22} />
        </Pressable>
      </View>

      <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: SP.lg }}>
        <Pressable onPress={tapOrb} accessibilityRole="button" accessibilityLabel={label} style={{ marginTop: reply ? 8 : 60 }}>
          <Orb size={reply ? 110 : 200} level={level} mode={phase === 'starting' ? 'thinking' : phase === 'idle' ? 'idle' : phase} />
        </Pressable>
        <Txt noTr style={{ color: C.mint300, fontWeight: '700', marginTop: 8 }} accessibilityLiveRegion="polite">{label}</Txt>
        {heard ? <Txt noTr style={{ color: 'rgba(255,255,255,0.55)', marginTop: 10, textAlign: 'center', fontSize: 15 }} numberOfLines={3}>“{heard}”</Txt> : null}
        {note ? <Txt noTr style={{ color: C.gold, marginTop: 14, textAlign: 'center', fontSize: 15, lineHeight: 22 }}>{note}</Txt> : null}
        {denied && <Button small kind="light" title="Open Settings" onPress={() => Linking.openSettings()} style={{ marginTop: 12 }} />}
        {reply ? (
          <ScrollView ref={scroll} style={{ marginTop: 16, alignSelf: 'stretch', borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
            contentContainerStyle={{ padding: 18 }} onContentSizeChange={(_, h) => { contentH.current = h; }}>
            <Txt noTr selectable style={{ color: 'rgba(255,255,255,0.92)', fontSize: 17, lineHeight: 27 }}>{reply}</Txt>
          </ScrollView>
        ) : null}
      </View>

      <View style={{ alignItems: 'center', paddingVertical: 16 }}>
        <Button kind="light" small title={t('vo.switchChat')} onPress={() => { close(); setTimeout(() => router.navigate('/ask'), 200); }} />
      </View>
    </SafeAreaView>
  );
}
