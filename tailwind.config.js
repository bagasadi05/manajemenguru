export default {
  darkMode: 'class',
  content: ['./index.html', './**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Tinos', 'serif'],
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.6s ease-out both',
        'fade-in': 'fade-in 0.5s ease-out both',
        shimmer: 'shimmer 4s infinite linear',
        'slide-down': 'slide-down 1.2s cubic-bezier(0.25, 1, 0.5, 1) both',
        'slide-up': 'slide-up 1.2s cubic-bezier(0.5, 0, 0.75, 0) both',
        float: 'float 4s ease-in-out infinite',
        'robot-entry': 'robotEntry 1s ease-out',
        'robot-float': 'robotFloat 3s ease-in-out infinite',
        'greeting-pop': 'greetingPop 0.5s ease-out backwards',
        blink: 'blink 3s infinite',
        wave: 'wave 2s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s infinite ease-in-out',
        'subtle-pop': 'subtle-pop 0.3s ease-out',
        'pulse-border': 'pulse-border 1.5s ease-in-out infinite',
      },
      keyframes: {
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        shimmer: {
          '0%': { 'background-position': '200% 0' },
          '100%': { 'background-position': '-200% 0' },
        },
        'slide-down': {
          from: { transform: 'translateY(-120%)' },
          to: { transform: 'translateY(40px)' },
        },
        'slide-up': {
          from: { transform: 'translateY(40px)' },
          to: { transform: 'translateY(-120%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(40px)' },
          '50%': { transform: 'translateY(30px)' },
        },
        robotEntry: {
          '0%': { transform: 'translateX(-50%) translateY(-300px) rotate(360deg)' },
          '100%': { transform: 'translateX(-50%) translateY(0) rotate(0deg)' },
        },
        robotFloat: {
          '0%, 100%': { transform: 'translateY(0) rotateY(0deg)' },
          '25%': { transform: 'translateY(-10px) rotateY(5deg)' },
          '75%': { transform: 'translateY(-10px) rotateY(-5deg)' },
        },
        greetingPop: {
          '0%': { transform: 'translateX(-50%) scale(0)' },
          '50%': { transform: 'translateX(-50%) scale(1.2)' },
          '100%': { transform: 'translateX(-50%) scale(1)' },
        },
        blink: {
          '0%, 90%, 100%': { transform: 'scaleY(1)' },
          '95%': { transform: 'scaleY(0.1)' },
        },
        wave: {
          '0%, 100%': { transform: 'rotate(-20deg)' },
          '50%': { transform: 'rotate(20deg)' },
        },
        'pulse-glow': {
          '0%, 100%': { 'box-shadow': '0 0 0 0 rgba(59, 130, 246, 0.4)' },
          '70%': { 'box-shadow': '0 0 0 10px rgba(59, 130, 246, 0)' },
        },
        'subtle-pop': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)' },
        },
        'pulse-border': {
          '0%, 100%': { 'border-color': 'rgba(59, 130, 246, 0.4)' },
          '50%': { 'border-color': 'rgba(59, 130, 246, 1)' },
        },
      },
    },
  },
  plugins: [],
};
