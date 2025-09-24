/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
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
        // VRIDGE 브랜드 색상 (로고 기반)
        brand: {
          primary: '#004AC0', // 진한 파란색 (메인 브랜드)
          'primary-dark': '#003A90',
          'primary-light': '#005AE0',
          secondary: '#0059DA', // 밝은 파란색 (서브 브랜드)
          'secondary-dark': '#0049BA',
          'secondary-light': '#0069FA',
          // 브랜드 그라디언트 조합
          'gradient-1': '#004AC0',
          'gradient-2': '#0059DA',
          'gradient-3': '#00FF88', // 네온 그린과의 조화
        },
        // 네온 효과 색상 팔레트 (액션 및 강조용)
        neon: {
          green: '#00FF88', // 메인 액션 색상 (CTA)
          'green-dark': '#00CC6A',
          'green-light': '#33FFB2',
          pink: '#FF0066', // 경고 및 중요 알림
          'pink-dark': '#CC0052',
          'pink-light': '#FF3388',
          cyan: '#00FFFF', // 정보 및 진행 상태
          purple: '#BB00FF', // 보조 강조 색상
        },
        // 블랙/화이트 기반 색상
        black: {
          DEFAULT: '#000000',
          soft: '#0A0A0A',
          medium: '#111111',
          hard: '#1A1A1A',
        },
        white: {
          DEFAULT: '#FFFFFF',
          5: 'rgba(255, 255, 255, 0.05)',
          10: 'rgba(255, 255, 255, 0.10)',
          20: 'rgba(255, 255, 255, 0.20)',
          30: 'rgba(255, 255, 255, 0.30)',
          50: 'rgba(255, 255, 255, 0.50)',
          70: 'rgba(255, 255, 255, 0.70)',
          90: 'rgba(255, 255, 255, 0.90)',
        },
        // 시맨틱 상태 색상
        success: {
          DEFAULT: '#00FF88',
          dark: '#00CC6A',
          light: '#33FFB2',
        },
        warning: {
          DEFAULT: '#FFD700',
          dark: '#CCAC00',
          light: '#FFE033',
        },
        error: {
          DEFAULT: '#FF0066',
          dark: '#CC0052',
          light: '#FF3388',
        },
        info: {
          DEFAULT: '#00FFFF',
          dark: '#00CCCC',
          light: '#33FFFF',
        },
        // 영상 생성 전용 색상 시스템
        video: {
          // 진행 상태 색상
          progress: {
            bg: 'rgba(255, 255, 255, 0.05)',
            fill: '#00FF88',
            text: '#FFFFFF',
          },
          // 플레이어 색상
          player: {
            bg: '#000000',
            controls: '#00FF88',
            overlay: 'rgba(0, 0, 0, 0.7)',
          },
          // 생성 상태별 색상
          status: {
            pending: '#FFD700',
            generating: '#00FFFF',
            completed: '#00FF88',
            failed: '#FF0066',
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
      // 폰트 패밀리 설정
      fontFamily: {
        sans: ['Pretendard', 'system-ui', 'sans-serif'], // 본문
        display: ['Inter', 'system-ui', 'sans-serif'], // 디스플레이
        mono: ['Space Mono', 'monospace'], // 코드
      },
      // 타이포그래피 스케일 (2개 기본 + 확장)
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
      },
      // 스페이싱 시스템 (8px 기반)
      spacing: {
        0.5: '0.125rem', // 2px
        1.5: '0.375rem', // 6px
        2.5: '0.625rem', // 10px
        3.5: '0.875rem', // 14px
        18: '4.5rem', // 72px
        22: '5.5rem', // 88px
        72: '18rem', // 288px
        84: '21rem', // 336px
        96: '24rem', // 384px
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
        responsive: 'repeat(auto-fit, minmax(320px, 1fr))',
        'mobile-1': '1fr',
        'desktop-2': 'repeat(2, 1fr)',
      },
      // 그림자 시스템 (브랜드 & 네온 효과 포함)
      boxShadow: {
        soft: '0 2px 8px 0 rgba(0, 0, 0, 0.1)',
        medium: '0 4px 16px 0 rgba(0, 0, 0, 0.12)',
        hard: '0 8px 32px 0 rgba(0, 0, 0, 0.16)',
        // 브랜드 색상 그림자 효과
        'brand-primary':
          '0 0 20px rgba(0, 74, 192, 0.4), 0 0 40px rgba(0, 74, 192, 0.2)',
        'brand-secondary':
          '0 0 20px rgba(0, 89, 218, 0.4), 0 0 40px rgba(0, 89, 218, 0.2)',
        'brand-glow':
          '0 0 30px rgba(0, 74, 192, 0.3), 0 0 60px rgba(0, 89, 218, 0.2)',
        // 네온 그림자 효과
        'neon-green':
          '0 0 20px rgba(0, 255, 136, 0.5), 0 0 40px rgba(0, 255, 136, 0.3)',
        'neon-pink':
          '0 0 20px rgba(255, 0, 102, 0.5), 0 0 40px rgba(255, 0, 102, 0.3)',
        'neon-cyan':
          '0 0 20px rgba(0, 255, 255, 0.5), 0 0 40px rgba(0, 255, 255, 0.3)',
        'neon-purple':
          '0 0 20px rgba(187, 0, 255, 0.5), 0 0 40px rgba(187, 0, 255, 0.3)',
        // 글래스모피즘용 그림자 (브랜드 색상 반영)
        glass: '0 8px 32px 0 rgba(0, 74, 192, 0.1)',
        'glass-light': '0 4px 16px 0 rgba(0, 89, 218, 0.1)',
        'glass-brand': '0 8px 32px 0 rgba(0, 74, 192, 0.15)',
      },
      // 경계선 반경
      borderRadius: {
        xs: '0.125rem',
        sm: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
  // 임의 값 사용 금지 강제 (ESLint 설정에서 추가 검증 필요)
  corePlugins: {
    // @apply 사용 금지를 위한 설정
    // Note: @apply는 별도 ESLint 규칙으로 제어
  },
};
