/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d6ff',
          300: '#a3baff',
          400: '#7b94ff',
          500: '#004ac1',
          600: '#0059db',
          700: '#003a9a',
          800: '#002d7a',
          900: '#00205a',
          950: '#001a47',
        },
      },
    },
  },
  plugins: [],
}
