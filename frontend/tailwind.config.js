/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#003fb1',
        'surface-container-high': '#e1e3e4',
        'outline-variant': '#c3c5d7',
        'on-surface-variant': '#434654',
      }
    },
  },
  plugins: [],
};
