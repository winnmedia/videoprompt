/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/widgets/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/shared/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // CLAUDE.md 준수: 디자인 토큰 시스템 - 임의 값 사용 금지
      colors: {
        // 브랜드 컬러 시스템 (WCAG 2.1 AA 대비 4.5:1 기준)
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6', // 메인 브랜드 색상
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // 시맨틱 상태 색상
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          900: '#14532d',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          900: '#78350f',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          900: '#7f1d1d',
        },
        // 영상 생성 전용 색상 시스템
        video: {
          // 진행 상태 색상
          progress: {
            bg: '#f3f4f6',    // 진행바 배경
            fill: '#3b82f6', // 진행바 채움 (primary-500)
            text: '#1f2937', // 진행률 텍스트
          },
          // 플레이어 색상
          player: {
            bg: '#000000',     // 플레이어 배경
            controls: '#ffffff', // 컨트롤 아이콘
            overlay: 'rgba(0, 0, 0, 0.5)', // 오버레이
          },
          // 생성 상태별 색상
          status: {
            pending: '#f59e0b',  // 대기 중
            generating: '#3b82f6', // 생성 중
            completed: '#22c55e',  // 완료
            failed: '#ef4444',     // 실패
          },
        },
        // 중성 색상 (그레이스케일)
        neutral: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
      },
      // 타이포그래피 스케일 (2개 기본 + 확장)
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
      },
      // 스페이싱 시스템 (8px 기반)
      spacing: {
        '0.5': '0.125rem', // 2px
        '1.5': '0.375rem', // 6px
        '2.5': '0.625rem', // 10px
        '3.5': '0.875rem', // 14px
        '18': '4.5rem',    // 72px
        '22': '5.5rem',    // 88px
        '72': '18rem',     // 288px
        '84': '21rem',     // 336px
        '96': '24rem',     // 384px
      },
      // 모션 시스템 (200ms 이하 애니메이션)
      animation: {
        'fade-in': 'fadeIn 150ms ease-out',
        'fade-out': 'fadeOut 150ms ease-in',
        'slide-in': 'slideIn 200ms ease-out',
        'slide-out': 'slideOut 200ms ease-in',
        'scale-in': 'scaleIn 150ms ease-out',
        'bounce-in': 'bounceIn 200ms ease-out',
        // 영상 생성 전용 애니메이션
        'progress-fill': 'progressFill 1000ms ease-out',
        'video-pulse': 'videoPulse 2000ms ease-in-out infinite',
        'loading-dots': 'loadingDots 1500ms ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideIn: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideOut: {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-10px)', opacity: '0' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '50%': { transform: 'scale(1.05)', opacity: '0.8' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        // 영상 생성 전용 키프레임
        progressFill: {
          '0%': { width: '0%' },
          '100%': { width: 'var(--progress-width)' },
        },
        videoPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        loadingDots: {
          '0%, 80%, 100%': { transform: 'scale(0)' },
          '40%': { transform: 'scale(1)' },
        },
      },
      // 반응형 그리드 시스템
      gridTemplateColumns: {
        'responsive': 'repeat(auto-fit, minmax(320px, 1fr))',
        'mobile-1': '1fr',
        'desktop-2': 'repeat(2, 1fr)',
      },
      // 그림자 시스템
      boxShadow: {
        'soft': '0 2px 8px 0 rgba(0, 0, 0, 0.1)',
        'medium': '0 4px 16px 0 rgba(0, 0, 0, 0.12)',
        'hard': '0 8px 32px 0 rgba(0, 0, 0, 0.16)',
      },
      // 경계선 반경
      borderRadius: {
        'xs': '0.125rem',
        'sm': '0.25rem',
        'md': '0.375rem',
        'lg': '0.5rem',
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
  // 임의 값 사용 금지 강제 (ESLint 설정에서 추가 검증 필요)
  corePlugins: {
    // @apply 사용 금지를 위한 설정
    // Note: @apply는 별도 ESLint 규칙으로 제어
  },
}