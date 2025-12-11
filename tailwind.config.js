/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'tech-black': '#050505', // Deep Black / very dark charcoal
        'tech-gray': '#121212', // Slightly lighter for panels
        'neon-blue': '#00BFFF', // Electric Blue (Primary Accent)
        'neon-cyan': '#00FFFF', // Cyan (Secondary Accent)
        'risk-crit': '#FF4500', // Bright Red
        'risk-warn': '#FFD700', // Amber/Yellow
        'risk-safe': '#39FF14', // Neon Green
        'text-main': '#E0E0E0', 
        'text-dim': '#A0A0A0',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        mono: ['"Source Code Pro"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
}
