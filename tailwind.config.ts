import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        purple: {
          50: '#F6F2FF',
          100: '#EEE8FF',
          200: '#DED4FF',
          300: '#C8B1FF',
          400: '#AD85FF',
          500: '#9352FF',
          600: '#8730F7',
          700: '#791EE3',
          800: '#6518BF',
          900: '#53169C',
          950: '#340B6A',
        },
      },
      transitionProperty: {
        top: 'top',
        bottom: 'bottom',
        left: 'left',
        right: 'right',
      },
    },
    fontFamily: {
      sans: ['Montserrat', 'sans-serif'],
    },
  },
  plugins: [],
  darkMode: 'selector',
} as Config;
