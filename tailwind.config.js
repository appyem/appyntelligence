/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        hacker: {
          bg: '#050505',
          panel: '#0a0a0a',
          border: '#1a1a1a',
          green: '#00ff41',
          cyan: '#00f3ff',
          red: '#ff003c',
          dim: '#8892b0',
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['"Inter"', 'sans-serif'],
      }
    }
  },
  plugins: []
}
