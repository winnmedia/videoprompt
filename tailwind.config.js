/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/widgets/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/entities/**/*.{js,ts,jsx,tsx,mdx}',
    './src/shared/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ✨ Unified Design Token System
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',   // Main brand color
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        neutral: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',   // Main text color
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        surface: {
          50: '#111315',
          100: '#0f1113',
          200: '#14171a',
          300: '#1a1f24',
          400: '#222930',
          500: '#2b333c',
          600: '#36404b',
          700: '#3f4b57',
          800: '#485766',
          900: '#516274',
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        accent: {
          50: '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          300: '#f0abfc',
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75',
          950: '#4a044e',
        },
      },
      spacing: {
        // ✨ Extended spacing scale
        18: '4.5rem',     // 72px
        88: '22rem',      // 352px
        128: '32rem',     // 512px
        144: '36rem',     // 576px

        // 🎯 Accessibility-first spacing
        'touch-target': '2.75rem',    // 44px - minimum touch target
        'touch-large': '3rem',        // 48px - comfortable touch target

        // 📐 Layout spacing tokens
        'section': '5rem',            // 80px - section spacing
        'container': '1.5rem',        // 24px - container padding
        'component': '1rem',          // 16px - component internal spacing
        'element': '0.5rem',          // 8px - element spacing
      },
      fontSize: {
        // ✨ Semantic typography scale
        '2xs': ['0.625rem', { lineHeight: '0.75rem' }],  // 10px - captions
        'xs': ['0.75rem', { lineHeight: '1rem' }],       // 12px - small text
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],   // 14px - body small
        'base': ['1rem', { lineHeight: '1.5rem' }],      // 16px - body
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],   // 18px - body large
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],    // 20px - subtitle
        '2xl': ['1.5rem', { lineHeight: '2rem' }],       // 24px - heading 4
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],  // 30px - heading 3
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],    // 36px - heading 2
        '5xl': ['3rem', { lineHeight: '1' }],            // 48px - heading 1
        '6xl': ['3.75rem', { lineHeight: '1' }],         // 60px - display
        '7xl': ['4.5rem', { lineHeight: '1' }],          // 72px - hero
        '8xl': ['6rem', { lineHeight: '1' }],            // 96px - hero large
        '9xl': ['8rem', { lineHeight: '1' }],            // 128px - hero extra
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        soft: '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        medium: '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        large: '0 10px 40px -10px rgba(0, 0, 0, 0.15), 0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        card: '0 1px 0 0 rgba(255,255,255,0.06), 0 20px 25px -5px rgba(0,0,0,0.25), 0 8px 10px -6px rgba(0,0,0,0.25)',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
    },
  },
  plugins: [],
};
