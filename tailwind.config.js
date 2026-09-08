/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        charcoal: {
          950: '#0f1312',
          900: '#14181a',
          800: '#1b2120',
          700: '#242b29',
          600: '#2c3532'
        },
        mint: {
          400: '#5eead4',
          500: '#34d399',
          600: '#10b981'
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'sans-serif']
      },
      borderRadius: {
        xl2: '1.25rem'
      }
    }
  },
  plugins: []
}
