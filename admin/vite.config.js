import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Nisbiy yo'llar: panel Vercel'da ildizda (/) ham, Express'da /admin/ da ham ishlaydi
// (marshrutlash HashRouter orqali, shuning uchun server sozlamasi kerak emas)
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
});
