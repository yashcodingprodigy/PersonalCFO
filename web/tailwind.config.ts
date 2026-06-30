import type { Config } from 'tailwindcss';

// PayWatch brand system — modern fintech, premium restraint.
// Deep pine green anchors trust; mint provides the single accent;
// warm paper neutrals keep it calm and editorial.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pine: {
          950: '#07211D',
          900: '#0B2F2A',
          800: '#10403A',
          700: '#16544B',
          600: '#1D6A5F',
          500: '#258274',
        },
        mint: {
          500: '#2FBC9B',
          400: '#4ECCAE',
          300: '#83DEC7',
          100: '#DFF5EE',
        },
        paper: {
          DEFAULT: '#F7F5F0',
          50: '#FCFBF8',
          100: '#F2EFE8',
          200: '#E7E2D6',
        },
        ink: {
          DEFAULT: '#1A2421',
          soft: '#48544F',
          faint: '#7C8782',
        },
        signal: {
          red: '#C2402A',
          amber: '#C77E1F',
          teal: '#1D8A78',
          green: '#2E9E44',
        },
        // ── Accent palette — muted jewel tones that sit calmly on the warm
        // paper background but give each category/section its own colour, so
        // the UI isn't a wall of green. Use 100 for tints, 500 for fills,
        // 600/700 for text/icons.
        ocean:  { 700: '#1B4F72', 600: '#21618C', 500: '#2E86C1', 100: '#D6EAF8' },
        sky:    { 700: '#1F6F86', 600: '#2A8AA6', 500: '#45A6C2', 100: '#DCF0F6' },
        violet: { 700: '#5B3A8E', 600: '#6C3FB0', 500: '#8E5FD0', 100: '#ECE3FA' },
        berry:  { 700: '#94306A', 600: '#B53D82', 500: '#D45FA2', 100: '#F8E1EE' },
        coral:  { 700: '#B23A2E', 600: '#D0493B', 500: '#E5705F', 100: '#FBE3DE' },
        gold:   { 700: '#9A6B12', 600: '#C08A1E', 500: '#E0A23B', 100: '#FAEFD6' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(26,36,33,0.05), 0 4px 16px rgba(26,36,33,0.06)',
        lift: '0 2px 4px rgba(26,36,33,0.06), 0 12px 32px rgba(26,36,33,0.10)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
};
export default config;
