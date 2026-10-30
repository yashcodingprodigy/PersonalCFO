// PayWatch design tokens for native — same palette as the web app (tailwind.config),
// sized for phones: 16pt body, 44pt touch targets, system fonts that scale with the
// user's text-size setting (Dynamic Type / Android font scale).
import { Platform, TextStyle, ViewStyle } from 'react-native';

export const C = {
  pine950: '#07211D', pine900: '#0B2F2A', pine800: '#10403A', pine700: '#16544B', pine600: '#1D6A5F', pine500: '#258274',
  mint500: '#2FBC9B', mint400: '#4ECCAE', mint300: '#83DEC7', mint100: '#DFF5EE',
  paper: '#F7F5F0', paper50: '#FCFBF8', paper100: '#F2EFE8', paper200: '#E7E2D6',
  ink: '#1A2421', inkSoft: '#48544F', inkFaint: '#7C8782',
  red: '#C2402A', amber: '#C77E1F', teal: '#1D8A78', green: '#2E9E44',
  ocean: '#2E86C1', violet: '#8E5FD0', berry: '#D45FA2', coral: '#E5705F', gold: '#E0A23B', gold100: '#FAEFD6', gold700: '#9A6B12',
  white: '#FFFFFF',
};

export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };
export const R = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const FONT = {
  display: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }) as string,
  body: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }) as string,
};

export const T: Record<string, TextStyle> = {
  h1: { fontFamily: FONT.display, fontSize: 30, lineHeight: 36, color: C.ink, fontWeight: Platform.OS === 'ios' ? '500' : 'normal' },
  h2: { fontFamily: FONT.display, fontSize: 22, lineHeight: 28, color: C.ink },
  h3: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: C.ink },
  body: { fontSize: 16, lineHeight: 23, color: C.ink },
  soft: { fontSize: 15, lineHeight: 22, color: C.inkSoft },
  small: { fontSize: 13, lineHeight: 18, color: C.inkSoft },
  tiny: { fontSize: 11.5, lineHeight: 16, color: C.inkFaint },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: C.inkFaint },
  num: { fontVariant: ['tabular-nums'] },
};

export const shadow: ViewStyle = Platform.select({
  ios: { shadowColor: '#1A2421', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
  android: { elevation: 2 },
  default: {},
}) as ViewStyle;

export const STATUS: Record<string, { color: string; bg: string; fg: string }> = {
  achieved: { color: C.gold, bg: C.gold100, fg: C.gold700 },
  on_track: { color: C.mint500, bg: C.mint100, fg: C.pine800 },
  stretch: { color: C.amber, bg: '#FBF0DF', fg: C.amber },
  needs_tradeoff: { color: C.red, bg: '#F8E3DF', fg: C.red },
};

export const KIND_ART: Record<string, { from: string; to: string; icon: string }> = {
  experience: { from: '#FF9A62', to: '#E8546B', icon: 'airplane' },
  purchase: { from: '#8B7CF6', to: '#4F46E5', icon: 'bag-handle' },
  family: { from: '#F472B6', to: '#E11D74', icon: 'heart' },
  safety: { from: '#34D3B0', to: '#0F766E', icon: 'shield-checkmark' },
  growth: { from: '#4ADE80', to: '#15803D', icon: 'leaf' },
  milestone: { from: '#FBBF24', to: '#D97706', icon: 'star' },
};
