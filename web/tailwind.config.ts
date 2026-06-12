import type { Config } from 'tailwindcss';

// Personal CFO brand system — modern fintech, premium restraint.
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
