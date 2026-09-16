import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

/**
 * "Clinical Luxury Dark" dizayn tizimi.
 * Ranglar CSS oʻzgaruvchilari orqali (src/app/globals.css) — shadcn/ui bilan mos.
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' },
      screens: { '2xl': '1280px' },
    },
    extend: {
      colors: {
        // ── Spec palitrasi ──
        'bg-base': 'var(--bg-base)',
        'bg-elevated': 'var(--bg-elevated)',
        surface: 'var(--surface)',
        line: 'var(--border)',
        accent: {
          DEFAULT: 'var(--accent)',
          2: 'var(--accent-2)',
          3: 'var(--accent-3)',
          foreground: 'var(--bg-base)',
        },
        text: {
          DEFAULT: 'var(--text)',
          muted: 'var(--text-muted)',
        },
        danger: 'var(--danger)',
        success: 'var(--accent-3)',
        warning: '#FFB547',
        // ── shadcn/ui semantik ranglar (HSL) ──
        border: 'hsl(var(--border-hsl))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'Manrope', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 10px)',
      },
      backgroundImage: {
        'gradient-accent': 'linear-gradient(135deg, #00D4FF 0%, #7C5CFF 100%)',
        'gradient-accent-soft': 'linear-gradient(135deg, rgba(0,212,255,0.18) 0%, rgba(124,92,255,0.18) 100%)',
        'gradient-border': 'linear-gradient(135deg, rgba(0,212,255,0.6), rgba(124,92,255,0.6))',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(0,212,255,0.25), 0 0 24px rgba(0,212,255,0.25)',
        'glow-lg': '0 0 0 1px rgba(0,212,255,0.3), 0 0 60px rgba(0,212,255,0.35)',
        'glow-violet': '0 0 0 1px rgba(124,92,255,0.3), 0 0 32px rgba(124,92,255,0.35)',
        'glow-mint': '0 0 0 1px rgba(0,255,178,0.3), 0 0 24px rgba(0,255,178,0.3)',
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 50px -20px rgba(0,0,0,0.6)',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        aurora: {
          '0%': { transform: 'translate3d(-10%, -10%, 0) rotate(0deg) scale(1)' },
          '33%': { transform: 'translate3d(8%, -4%, 0) rotate(120deg) scale(1.15)' },
          '66%': { transform: 'translate3d(-4%, 10%, 0) rotate(240deg) scale(0.95)' },
          '100%': { transform: 'translate3d(-10%, -10%, 0) rotate(360deg) scale(1)' },
        },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.8' },
          '100%': { transform: 'scale(1.8)', opacity: '0' },
        },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
        'ticket-out': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '30%': { opacity: '1' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        aurora: 'aurora 28s ease-in-out infinite',
        'aurora-slow': 'aurora 42s ease-in-out infinite reverse',
        marquee: 'marquee 40s linear infinite',
        'pulse-ring': 'pulse-ring 1.6s cubic-bezier(0.2, 0.8, 0.2, 1) infinite',
        shimmer: 'shimmer 2.5s linear infinite',
        'ticket-out': 'ticket-out 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [animate],
};

export default config;
