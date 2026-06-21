/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#e91e8c',
          600: '#db2777',
          700: '#be185d',
          800: '#9d174d',
          900: '#831843',
        },
        sidebar: '#1C1325',
        'sidebar-hover': '#2a1f38',
      },
      fontFamily: {
        sans: ['Noto Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
