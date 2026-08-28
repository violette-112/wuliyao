/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'game-bg': '#FDF6EC',
        'game-green': '#7BC47F',
        'game-yellow': '#FFE066',
        'game-locked': '#555555',
        'game-grid': '#dddddd',
      },
      fontFamily: {
        'pixel': ['"Press Start 2P"', 'cursive'],
        'body': ['Nunito', 'system-ui', 'sans-serif'],
      },
      animation: {
        'breathe': 'breathe 2s ease-in-out infinite',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { borderColor: 'rgba(123, 196, 127, 0.4)' },
          '50%': { borderColor: 'rgba(123, 196, 127, 1)' },
        }
      }
    },
  },
  plugins: [],
}
