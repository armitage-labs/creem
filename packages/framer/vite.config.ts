import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import mkcert from 'vite-plugin-mkcert'
import framer from 'vite-plugin-framer'

export default defineConfig({
  plugins: [react(), mkcert(), framer()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: { target: 'ES2022' },
  server: {
    proxy: {
      '/creem-api': {
        target: 'https://api.creem.io',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/creem-api/, '')
      },
      '/creem-test-api': {
        target: 'https://test-api.creem.io',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/creem-test-api/, '')
      }
    }
  }
})
