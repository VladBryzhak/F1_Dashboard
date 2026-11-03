import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Node's environment, typed here without pulling in all of @types/node.
declare const process: { env: Record<string, string | undefined> }

// In dev, proxy /api to the Express backend so the browser and API share an
// origin (no CORS needed) and the client code can use relative /api paths.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        // API_PORT: a second checkout's server (git worktree) next to the main one.
        target: `http://localhost:${process.env.API_PORT ?? 3001}`,
        changeOrigin: true,
      },
    },
  },
})
