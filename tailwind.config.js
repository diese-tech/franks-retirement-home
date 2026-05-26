/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Boogaloo', 'sans-serif'],
        body: ['Verdana', 'Geneva', 'Tahoma', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        ui: ['Share Tech Mono', 'monospace'],
      },
      colors: {
        brand: {
          950: '#06080f',
          900: '#0a0e1a',
          800: '#111827',
          700: '#1a2235',
          600: '#243049',
        },
        gold: { 400: '#f6c744', 500: '#e5a813' },
        ember: { 400: '#ff6b4a', 500: '#e04428' },
        frost: { 400: '#67e8f9', 500: '#22d3ee' },
        'frh-yellow':     '#ffd400',
        'frh-orange':     '#ff8c00',
        'frh-xp-blue':    '#1f6fff',
        'frh-purple':     '#6f35ff',
        'frh-lime':       '#b5e853',
        'frh-cream':      '#f4e0b5',
        'frh-ink':        '#111111',
        'frh-deep-green': '#163b00',
        'frh-peach':      '#F5C8A0',
        'frh-tan':        '#C8B89A',
        'frh-blue':       '#2B5BA8',
        'frh-olive':      '#5C6B2E',
        'frh-red':        '#CC3300',
        'frh-deep-red':   '#8a1c00',
        'frh-deep-blue':  '#1040aa',
        'frh-navy':       '#102a55',
        'frh-base':         'var(--frh-base)',
        'frh-surface':      'var(--frh-surface)',
        'frh-surface-alt':  'var(--frh-surface-alt)',
        'frh-border':       'var(--frh-border)',
        'frh-border-strong':'var(--frh-border-strong)',
        'frh-text':         'var(--frh-text)',
        'frh-text-muted':   'var(--frh-text-muted)',
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.35s ease-out both',
        'fade-in': 'fadeIn 0.3s ease-out both',
      },
      keyframes: {
        pulseGlow: {
          '0%,100%': { boxShadow: '0 0 6px rgba(255,75,50,0.25)' },
          '50%':     { boxShadow: '0 0 22px rgba(255,75,50,0.6)' },
        },
        slideUp: {
          from: { opacity: 0, transform: 'translateY(10px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: 0 },
          to:   { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};
