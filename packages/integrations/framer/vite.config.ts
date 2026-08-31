import { cp, copyFile, mkdir } from 'node:fs/promises'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react-swc'
import mkcert from 'vite-plugin-mkcert'
import framer from 'vite-plugin-framer'

const REVIEW_SOURCE_FILES = ['index.html', 'package.json', 'postcss.config.js', 'tsconfig.json', 'vite.config.ts', 'vitest.config.ts'] as const

/** Keep the optimized runtime while giving marketplace reviewers readable source. */
function includeReviewSource(): Plugin {
  return {
    name: 'include-review-source',
    apply: 'build',
    async closeBundle() {
      const reviewSourceDir = new URL('./dist/review-source/', import.meta.url)
      await mkdir(reviewSourceDir, { recursive: true })
      await Promise.all([
        cp(new URL('./src/', import.meta.url), new URL('./dist/review-source/src/', import.meta.url), { recursive: true }),
        copyFile(new URL('./REVIEW_NOTES.md', import.meta.url), new URL('./dist/REVIEW_NOTES.md', import.meta.url)),
        ...REVIEW_SOURCE_FILES.map(file => copyFile(new URL(`./${file}`, import.meta.url), new URL(`./dist/review-source/${file}`, import.meta.url)))
      ])
    }
  }
}

export default defineConfig({
  plugins: [react(), mkcert(), framer(), includeReviewSource()],
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
