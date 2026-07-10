import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000', // Points explicitly to FastAPI's port
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''), // Strips /api before passing to FastAPI
      }
    }
  }
})