import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Panel Express orqali /admin/ manzilida ochiladi
export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
});
