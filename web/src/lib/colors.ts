// Per-category accent colours. Full static class strings (not built dynamically)
// so Tailwind's content scan keeps them. Gives each category its own colour
// across the app so the UI isn't a wall of green.

export interface Accent { bg: string; text: string; ring: string; dot: string }

// Insurance categories (used by the marketplace + My-policies + records).
export const INSURANCE_CAT_COLOR: Record<string, Accent> = {
  term_life:         { bg: 'bg-ocean-100',  text: 'text-ocean-700',  ring: 'ring-ocean-500',  dot: 'bg-ocean-500' },
  health:            { bg: 'bg-coral-100',  text: 'text-coral-700',  ring: 'ring-coral-500',  dot: 'bg-coral-500' },
  personal_accident: { bg: 'bg-gold-100',   text: 'text-gold-700',   ring: 'ring-gold-500',   dot: 'bg-gold-500' },
  critical_illness:  { bg: 'bg-berry-100',  text: 'text-berry-700',  ring: 'ring-berry-500',  dot: 'bg-berry-500' },
  motor:             { bg: 'bg-violet-100', text: 'text-violet-700', ring: 'ring-violet-500', dot: 'bg-violet-500' },
  home:              { bg: 'bg-sky-100',    text: 'text-sky-700',    ring: 'ring-sky-500',    dot: 'bg-sky-500' },
  travel:            { bg: 'bg-mint-100',   text: 'text-pine-700',   ring: 'ring-mint-500',   dot: 'bg-mint-500' },
  life_endowment:    { bg: 'bg-gold-100',   text: 'text-gold-700',   ring: 'ring-gold-500',   dot: 'bg-gold-500' },
  other:             { bg: 'bg-paper-100',  text: 'text-ink-soft',   ring: 'ring-paper-200',  dot: 'bg-ink-faint' },
};
export const insCatColor = (k: string): Accent => INSURANCE_CAT_COLOR[k] || INSURANCE_CAT_COLOR.other;

// Monthly-records categories.
export const RECORD_CAT_COLOR: Record<string, Accent> = {
  'Income & salary':                { bg: 'bg-ocean-100',  text: 'text-ocean-700',  ring: 'ring-ocean-500',  dot: 'bg-ocean-500' },
  'Tax statements':                 { bg: 'bg-coral-100',  text: 'text-coral-700',  ring: 'ring-coral-500',  dot: 'bg-coral-500' },
  'Banking & spending':             { bg: 'bg-gold-100',   text: 'text-gold-700',   ring: 'ring-gold-500',   dot: 'bg-gold-500' },
  'Investments':                    { bg: 'bg-violet-100', text: 'text-violet-700', ring: 'ring-violet-500', dot: 'bg-violet-500' },
  'Loans':                          { bg: 'bg-berry-100',  text: 'text-berry-700',  ring: 'ring-berry-500',  dot: 'bg-berry-500' },
  'Deductions & tax-saving proofs': { bg: 'bg-mint-100',   text: 'text-pine-700',   ring: 'ring-mint-500',   dot: 'bg-mint-500' },
  'Insurance & property':           { bg: 'bg-sky-100',    text: 'text-sky-700',    ring: 'ring-sky-500',    dot: 'bg-sky-500' },
  'Business & self-employed':       { bg: 'bg-ocean-100',  text: 'text-ocean-700',  ring: 'ring-ocean-500',  dot: 'bg-ocean-500' },
};
export const recCatColor = (k: string): Accent => RECORD_CAT_COLOR[k] || INSURANCE_CAT_COLOR.other;

// A simple rotating palette for arbitrary lists (charts, dimension bars, etc.).
export const PALETTE_HEX = ['#2E86C1', '#E5705F', '#E0A23B', '#8E5FD0', '#2FBC9B', '#45A6C2', '#D45FA2', '#16544B'];
