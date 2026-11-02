import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // `npm run preview` : la version de production locale parle à l'API locale, comme sur Vercel (même origine)
  preview: { proxy: { '/api': 'http://localhost:5000' } },
})
