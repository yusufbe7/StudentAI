/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
      colors: {
        brand: { 50: '#eef7ff', 100: '#d9edff', 400: '#4aa8f0', 500: '#2b8fe0', 600: '#1c74c2', 700: '#185e9c' },
      },
      boxShadow: {
        glass: '0 8px 32px rgba(15, 50, 90, 0.12), inset 0 1px 0 rgba(255,255,255,0.6)',
      },
    },
  },
  plugins: [],
};
