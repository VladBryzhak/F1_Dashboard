import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In dev, proxy /api to the Express backend so the browser and API share an
// origin (no CORS needed) and the client code can use relative /api paths.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
