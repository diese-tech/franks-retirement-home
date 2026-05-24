/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Rajdhani', 'sans-serif'],
        body: ['Exo 2', 'sans-serif'],
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
