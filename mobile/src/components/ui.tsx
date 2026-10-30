// PayWatch native UI kit. Every screen is built from these, so sizing, spacing,
// touch targets (≥44pt), Dynamic Type and Hindi translation behave the same everywhere.
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Easing, KeyboardTypeOptions, Modal, Pressable, RefreshControl, ScrollView,
  StyleProp, StyleSheet, Text, TextInput, TextProps, TextStyle, View, ViewStyle, KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Defs, LinearGradient as SvgGrad, Stop, RadialGradient } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { C, R, SP, T, shadow, FONT } from '@/lib/theme';
import { useTr } from '@/lib/i18n';
import { groupDigits, digitsOnly } from '@/lib/format';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export const Icon = ({ name, size = 20, color = C.ink, style }: { name: IconName; size?: number; color?: string; style?: any }) =>
  <Ionicons name={name} size={size} color={color} style={style} />;

/** Text that auto-translates to Hindi when the app is in Hindi. Use noTr for names/numbers. */
export function Txt({ children, noTr, style, ...rest }: TextProps & { children?: React.ReactNode; noTr?: boolean }) {
  const flat = typeof children === 'string' || typeof children === 'number' ? String(children)
    : Array.isArray(children) && children.every((c) => typeof c === 'string' || typeof c === 'number') ? children.join('') : null;
  const translated = useTr(!noTr && flat != null ? flat : null);
  return <Text style={[T.body, style]} maxFontSizeMultiplier={1.6} {...rest}>{!noTr && flat != null ? translated : children}</Text>;
}
export const H1 = (p: TextProps & { children?: React.ReactNode; noTr?: boolean }) => <Txt accessibilityRole="header" {...p} style={[T.h1, p.style]} />;
export const H2 = (p: TextProps & { children?: React.ReactNode; noTr?: boolean }) => <Txt accessibilityRole="header" {...p} style={[T.h2, p.style]} />;
export const H3 = (p: TextProps & { children?: React.ReactNode; noTr?: boolean }) => <Txt {...p} style={[T.h3, p.style]} />;
export const Soft = (p: TextProps & { children?: React.ReactNode; noTr?: boolean }) => <Txt {...p} style={[T.soft, p.style]} />;
export const Small = (p: TextProps & { children?: React.ReactNode; noTr?: boolean }) => <Txt {...p} style={[T.small, p.style]} />;
export const Tiny = (p: TextProps & { children?: React.ReactNode; noTr?: boolean }) => <Txt {...p} style={[T.tiny, p.style]} />;
export const Label = (p: TextProps & { children?: React.ReactNode; noTr?: boolean }) => <Txt {...p} style={[T.label, p.style]} />;
export const Num = ({ style, ...p }: TextProps & { children?: React.ReactNode }) => <Txt noTr {...p} style={[T.num, style]} />;

/** Scrollable screen with pull-to-refresh and safe areas. Sub-pages get the native header from the Stack. */
export function Screen({ children, onRefresh, refreshing = false, padded = true, edges, style, contentStyle, scroll = true, dark }: {
  children: React.ReactNode; onRefresh?: () => void; refreshing?: boolean; padded?: boolean; edges?: ('top' | 'bottom' | 'left' | 'right')[];
  style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>; scroll?: boolean; dark?: boolean;
}) {
  const bg = dark ? C.pine950 : C.paper;
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[padded && { padding: SP.lg, paddingBottom: 48 }, contentStyle]}
      keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.mint500} colors={[C.mint500]} /> : undefined}>
      {children}
    </ScrollView>
  ) : <View style={[{ flex: 1 }, padded && { padding: SP.lg }, contentStyle]}>{children}</View>;
  return (
    <SafeAreaView edges={edges ?? ['left', 'right']} style={[{ flex: 1, backgroundColor: bg }, style]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{body}</KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress, tone = 'white', accessibilityLabel }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; tone?: 'white' | 'dark' | 'mint' | 'paper'; accessibilityLabel?: string;
}) {
  const bg = tone === 'dark' ? C.pine900 : tone === 'mint' ? C.mint100 : tone === 'paper' ? C.paper50 : C.white;
  const s = [styles.card, { backgroundColor: bg }, tone === 'paper' && { borderWidth: 1, borderColor: C.paper200 }, style];
  if (!onPress) return <View style={s}>{children}</View>;
  return (
    <Pressable onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }} accessibilityRole="button" accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [s, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}>
      {children}
    </Pressable>
  );
}

export function Button({ title, onPress, kind = 'primary', loading, disabled, icon, style, small, noTr }: {
  title: string; onPress?: () => void; kind?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'mint' | 'light'; loading?: boolean; disabled?: boolean;
  icon?: IconName; style?: StyleProp<ViewStyle>; small?: boolean; noTr?: boolean;
}) {
  const k = {
    primary: { bg: C.pine900, fg: C.white, border: C.pine900 },
    mint: { bg: C.mint500, fg: C.pine950, border: C.mint500 },
    secondary: { bg: C.white, fg: C.pine900, border: C.paper200 },
    ghost: { bg: 'transparent', fg: C.pine700, border: 'transparent' },
    danger: { bg: C.white, fg: C.red, border: '#EBC7BF' },
    light: { bg: 'rgba(255,255,255,0.12)', fg: C.white, border: 'rgba(255,255,255,0.18)' },
  }[kind];
  const off = disabled || loading;
  return (
    <Pressable disabled={off} accessibilityRole="button" accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress?.(); }}
      style={({ pressed }) => [styles.btn, small && styles.btnSmall, { backgroundColor: k.bg, borderColor: k.border, opacity: off ? 0.5 : pressed ? 0.85 : 1 }, style]}>
      {loading ? <ActivityIndicator color={k.fg} /> : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon && <Icon name={icon} size={small ? 16 : 18} color={k.fg} />}
          <Txt noTr={noTr} style={{ color: k.fg, fontWeight: '700', fontSize: small ? 14 : 16 }} numberOfLines={1}>{title}</Txt>
        </View>
      )}
    </Pressable>
  );
}

export function Chip({ label, color = C.pine800, bg = C.mint100, style, noTr }: { label: string; color?: string; bg?: string; style?: StyleProp<ViewStyle>; noTr?: boolean }) {
  return <View style={[{ backgroundColor: bg, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }, style]}>
    <Txt noTr={noTr} style={{ color, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{label}</Txt>
  </View>;
}

export function Field({ label, hint, error, children }: { label?: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: SP.lg }}>
      {label ? <Txt style={styles.fieldLabel}>{label}</Txt> : null}
      {children}
      {error ? <Small style={{ color: C.red, marginTop: 4 }}>{error}</Small> : hint ? <Tiny style={{ marginTop: 4 }}>{hint}</Tiny> : null}
    </View>
  );
}

export function Input({ label, hint, error, value, onChangeText, placeholder, keyboardType, secure, multiline, autoCapitalize, autoComplete, maxLength, style, onSubmitEditing, returnKeyType, autoFocus, textContentType, editable = true }: {
  label?: string; hint?: string; error?: string; value: string; onChangeText: (s: string) => void; placeholder?: string; keyboardType?: KeyboardTypeOptions;
  secure?: boolean; multiline?: boolean; autoCapitalize?: 'none' | 'sentences' | 'words'; autoComplete?: any; maxLength?: number; style?: StyleProp<TextStyle>;
  onSubmitEditing?: () => void; returnKeyType?: any; autoFocus?: boolean; textContentType?: any; editable?: boolean;
}) {
  const ph = useTr(placeholder);
  return (
    <Field label={label} hint={hint} error={error}>
      <TextInput value={value} onChangeText={onChangeText} placeholder={ph} placeholderTextColor={C.inkFaint} keyboardType={keyboardType}
        secureTextEntry={secure} multiline={multiline} autoCapitalize={autoCapitalize} autoComplete={autoComplete} maxLength={maxLength}
        onSubmitEditing={onSubmitEditing} returnKeyType={returnKeyType} autoFocus={autoFocus} textContentType={textContentType} editable={editable}
        accessibilityLabel={label || placeholder} maxFontSizeMultiplier={1.4}
        style={[styles.input, multiline && { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 }, !editable && { opacity: 0.6 }, style]} />
    </Field>
  );
}

/** ₹ input with Indian commas as you type. value/onChange use plain rupee digits. */
export function MoneyInput({ label, hint, value, onChange, placeholder = '0' }: { label?: string; hint?: string; value: string; onChange: (digits: string) => void; placeholder?: string }) {
  return (
    <Field label={label} hint={hint}>
      <View style={{ flexDirection: 'row' }}>
        <View style={styles.rupee}><Txt noTr style={{ fontWeight: '700', color: C.inkSoft }}>₹</Txt></View>
        <TextInput value={groupDigits(value)} onChangeText={(s) => onChange(digitsOnly(s))} placeholder={placeholder} placeholderTextColor={C.inkFaint}
          keyboardType="number-pad" accessibilityLabel={label} maxFontSizeMultiplier={1.4}
          style={[styles.input, { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }, T.num]} />
      </View>
    </Field>
  );
}

export function Segmented<V extends string | number>({ options, value, onChange, dark, style }: {
  options: { v: V; label: string }[]; value: V; onChange: (v: V) => void; dark?: boolean; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flexDirection: 'row', backgroundColor: dark ? 'rgba(255,255,255,0.1)' : C.paper100, borderRadius: R.pill, padding: 3 }, style]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.v === value;
        return (
          <Pressable key={String(o.v)} onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(o.v); }} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={{ flex: 1, minHeight: 36, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8,
              backgroundColor: on ? (dark ? C.mint500 : C.white) : 'transparent', ...(on && !dark ? shadow : {}) }}>
            <Txt numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: on ? (dark ? C.pine950 : C.ink) : dark ? 'rgba(255,255,255,0.7)' : C.inkSoft }}>{o.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Native-feeling picker: tap → bottom sheet list. */
export function Select({ label, value, options, onChange, placeholder = 'Select…', hint }: {
  label?: string; value: string; options: { v: string; label: string }[]; onChange: (v: string) => void; placeholder?: string; hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.v === value);
  const insets = useSafeAreaInsets();
  return (
    <Field label={label} hint={hint}>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={label} style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <Txt style={{ color: cur ? C.ink : C.inkFaint, flex: 1 }} numberOfLines={1}>{cur?.label || placeholder}</Txt>
        <Icon name="chevron-down" size={18} color={C.inkFaint} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 8, maxHeight: '70%' }]}>
          <View style={styles.grabber} />
          {label ? <H3 style={{ paddingHorizontal: SP.lg, paddingBottom: SP.sm }}>{label}</H3> : null}
          <FlatList data={options} keyExtractor={(o) => o.v} renderItem={({ item }) => (
            <Pressable onPress={() => { onChange(item.v); setOpen(false); }} style={({ pressed }) => [styles.option, pressed && { backgroundColor: C.paper100 }]}>
              <Txt style={{ flex: 1 }}>{item.label}</Txt>
              {item.v === value && <Icon name="checkmark" color={C.pine700} />}
            </Pressable>
          )} />
        </View>
      </Modal>
    </Field>
  );
}

/** Bottom sheet wrapper. */
export function Sheet({ visible, onClose, title, children, full }: { visible: boolean; onClose: () => void; title?: string; children: React.ReactNode; full?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.sheet, { paddingBottom: insets.bottom + 8 }, full ? { height: '90%' } : { maxHeight: '90%' }]}>
        <View style={styles.grabber} />
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.lg, paddingBottom: SP.sm }}>
          {title ? <H3 style={{ flex: 1 }}>{title}</H3> : <View style={{ flex: 1 }} />}
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close"><Icon name="close" size={24} color={C.inkSoft} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: SP.lg, paddingTop: 4 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Row({ icon, title, subtitle, right, onPress, color = C.pine700, last, noTr }: {
  icon?: IconName; title: string; subtitle?: string; right?: React.ReactNode; onPress?: () => void; color?: string; last?: boolean; noTr?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && { backgroundColor: C.paper50 }]}>
      {icon && <View style={[styles.rowIcon, { backgroundColor: color + '18' }]}><Icon name={icon} size={19} color={color} /></View>}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt noTr={noTr} style={{ fontWeight: '600' }} numberOfLines={2}>{title}</Txt>
        {subtitle ? <Small numberOfLines={3} style={{ marginTop: 2 }}>{subtitle}</Small> : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-forward" size={18} color={C.inkFaint} /> : null)}
    </Pressable>
  );
}

export function Stat({ label, value, sub, dark, style }: { label: string; value: string; sub?: string; dark?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flex: 1, padding: 12, borderRadius: R.md, backgroundColor: dark ? 'rgba(255,255,255,0.06)' : C.paper50, borderWidth: 1, borderColor: dark ? 'rgba(255,255,255,0.1)' : C.paper200 }, style]}>
      <Txt style={{ fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: dark ? 'rgba(255,255,255,0.5)' : C.inkFaint }} numberOfLines={1}>{label}</Txt>
      <Num style={{ fontFamily: FONT.display, fontSize: 18, marginTop: 4, color: dark ? C.mint300 : C.ink }} adjustsFontSizeToFit numberOfLines={1}>{value}</Num>
      {sub ? <Tiny style={dark ? { color: 'rgba(255,255,255,0.45)' } : undefined}>{sub}</Tiny> : null}
    </View>
  );
}

export function Ring({ value, size = 56, stroke = 6, color = C.mint500, track = C.ink, children }: { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeOpacity={0.12} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c}`} strokeDashoffset={c * (1 - v)} />
      </Svg>
      {children}
    </View>
  );
}

export function Bar({ value, color = C.mint500, height = 8, track = C.paper100 }: { value: number; color?: string; height?: number; track?: string }) {
  return <View style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}>
    <View style={{ width: `${Math.max(0, Math.min(100, value * 100))}%`, height, backgroundColor: color, borderRadius: height }} />
  </View>;
}

/** The PayWatch orb — the brain's face. Breathes; pulses with voice level. */
export function Orb({ size = 160, level = 0, mode = 'idle' }: { size?: number; level?: number; mode?: 'idle' | 'listening' | 'thinking' | 'speaking' }) {
  const breathe = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: mode === 'thinking' ? 700 : 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: mode === 'thinking' ? 700 : 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const s = Animated.loop(Animated.timing(spin, { toValue: 1, duration: mode === 'thinking' ? 2500 : 14000, easing: Easing.linear, useNativeDriver: true }));
    a.start(); s.start();
    return () => { a.stop(); s.stop(); };
  }, [mode, breathe, spin]);
  const base = 1 + (mode === 'listening' ? Math.min(0.35, level * 0.35) : mode === 'speaking' ? 0.04 : 0);
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [base, base + 0.05] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={{ width: size * 1.3, height: size * 1.3, alignItems: 'center', justifyContent: 'center' }} accessible={false}>
      <Animated.View style={{ position: 'absolute', width: size * 1.3, height: size * 1.3, opacity: mode === 'idle' ? 0.35 : 0.75, transform: [{ scale }] }}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs><RadialGradient id="halo" cx="50%" cy="50%" r="50%"><Stop offset="0.55" stopColor={C.mint500} stopOpacity="0.35" /><Stop offset="1" stopColor={C.mint500} stopOpacity="0" /></RadialGradient></Defs>
          <Circle cx="50" cy="50" r="50" fill="url(#halo)" />
        </Svg>
      </Animated.View>
      <Animated.View style={{ width: size, height: size, transform: [{ scale }, { rotate }] }}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <SvgGrad id="orb" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#83DEC7" /><Stop offset="0.45" stopColor="#2FBC9B" /><Stop offset="1" stopColor="#0F5C55" />
            </SvgGrad>
            <RadialGradient id="shine" cx="32%" cy="28%" r="45%"><Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.75" /><Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" /></RadialGradient>
            <RadialGradient id="violet" cx="75%" cy="78%" r="40%"><Stop offset="0" stopColor="#46C9E0" stopOpacity="0.7" /><Stop offset="1" stopColor="#46C9E0" stopOpacity="0" /></RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="48" fill="url(#orb)" />
          <Circle cx="50" cy="50" r="48" fill="url(#violet)" />
          <Circle cx="50" cy="50" r="48" fill="url(#shine)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return <View style={{ paddingVertical: 60, alignItems: 'center', gap: 12 }} accessibilityLabel="Loading">
    <Orb size={72} mode="thinking" />
    {label ? <Small>{label}</Small> : null}
  </View>;
}
export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <Card style={{ alignItems: 'center', gap: 10 }}>
    <Icon name="cloud-offline-outline" size={28} color={C.inkFaint} />
    <Soft style={{ textAlign: 'center' }}>{message}</Soft>
    {onRetry && <Button small kind="secondary" title="Try again" onPress={onRetry} />}
  </Card>;
}
export function Empty({ icon = 'sparkles-outline', title, body, action }: { icon?: IconName; title: string; body?: string; action?: React.ReactNode }) {
  return <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 28 }}>
    <Icon name={icon} size={30} color={C.mint500} />
    <H3 style={{ textAlign: 'center' }}>{title}</H3>
    {body ? <Soft style={{ textAlign: 'center' }}>{body}</Soft> : null}
    {action}
  </Card>;
}
export function Disclaimer({ children }: { children: string }) {
  return <Tiny style={{ marginTop: SP.lg, lineHeight: 16 }}>{children}</Tiny>;
}
export function Section({ title, sub, right, children, style }: { title?: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ marginTop: SP.xxl }, style]}>
    {(title || right) && <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: SP.md, gap: 8 }}>
      <View style={{ flex: 1 }}>
        {title ? <H2>{title}</H2> : null}
        {sub ? <Small style={{ marginTop: 2 }}>{sub}</Small> : null}
      </View>
      {right}
    </View>}
    {children}
  </View>;
}
/** Tap-to-expand card. */
export function Disclosure({ title, subtitle, left, right, children, initiallyOpen = false, noTr }: {
  title: string; subtitle?: string; left?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; initiallyOpen?: boolean; noTr?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={[styles.card, { backgroundColor: C.white, padding: 0, overflow: 'hidden' }]}>
      <Pressable onPress={() => { Haptics.selectionAsync().catch(() => {}); setOpen(!open); }} accessibilityRole="button" accessibilityState={{ expanded: open }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.lg }}>
        {left}
        <View style={{ flex: 1 }}>
          <Txt noTr={noTr} style={{ fontWeight: '700' }}>{title}</Txt>
          {subtitle ? <Small noTr={noTr} style={{ marginTop: 2 }}>{subtitle}</Small> : null}
        </View>
        {right}
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={C.inkFaint} />
      </Pressable>
      {open && <View style={{ paddingHorizontal: SP.lg, paddingBottom: SP.lg, borderTopWidth: 1, borderTopColor: C.paper100, paddingTop: SP.md }}>{children}</View>}
    </View>
  );
}
export function Bullets({ items, color = C.mint500, mark = '•', noTr }: { items: string[]; color?: string; mark?: string; noTr?: boolean }) {
  return <View style={{ gap: 6 }}>{items.map((s, i) => (
    <View key={i} style={{ flexDirection: 'row', gap: 8 }}><Txt noTr style={{ color, fontWeight: '800' }}>{mark}</Txt><Txt noTr={noTr} style={{ flex: 1, fontSize: 14.5, color: C.inkSoft, lineHeight: 21 }}>{s}</Txt></View>
  ))}</View>;
}
export const Gap =({ h = SP.md }: { h?: number }) => <View style={{ height: h }} />;
export const Divider = () => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.paper200, marginVertical: SP.md }} />;

export function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return <Pressable onPress={() => onChange(!checked)} accessibilityRole="checkbox" accessibilityState={{ checked }} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 6 }}>
    <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: checked ? C.pine700 : C.paper200, backgroundColor: checked ? C.pine700 : C.white, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
      {checked && <Icon name="checkmark" size={16} color={C.white} />}
    </View>
    <View style={{ flex: 1 }}>{children}</View>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { borderRadius: R.lg, padding: SP.lg, ...shadow },
  btn: { minHeight: 50, borderRadius: R.pill, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  btnSmall: { minHeight: 40, paddingHorizontal: 14 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: C.inkSoft, marginBottom: 6 },
  input: { minHeight: 50, borderRadius: R.md, borderWidth: 1, borderColor: C.paper200, backgroundColor: C.white, paddingHorizontal: 14, fontSize: 16, color: C.ink },
  rupee: { minHeight: 50, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: C.paper100, borderWidth: 1, borderRightWidth: 0, borderColor: C.paper200, borderTopLeftRadius: R.md, borderBottomLeftRadius: R.md },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(7,33,29,0.35)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: C.paper200, marginBottom: 10 },
  option: { minHeight: 50, paddingHorizontal: SP.lg, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.paper200 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 56 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.paper200 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
