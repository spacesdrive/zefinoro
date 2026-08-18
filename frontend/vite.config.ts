import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      // In development the Worker runs separately on 8787; in production both
      // are served from the same origin, so the app always calls a relative /api.
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Chunking is left to Rollup on purpose.
    //
    // An earlier version forced React into its own manual chunk. That produced
    // smaller-looking output and a blank page: a sibling chunk evaluated before
    // the React chunk had initialised and blew up on `forwardRef` of undefined.
    // Route-level `lazy()` already gives the split that matters, and Rollup
    // works out a load order that is actually correct.
    chunkSizeWarningLimit: 800,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
