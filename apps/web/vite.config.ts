import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const libDir = fileURLToPath(new URL('./src/lib', import.meta.url));

// SvelteKit 3: configuration lives in the plugin (svelte.config.js is gone).
export default defineConfig({
  resolve: {
    alias: {
      '#lib': libDir,
      '#lib/': `${libDir}/`
    }
  },
  plugins: [
    sveltekit({
      preprocess: vitePreprocess(),
      // SPA mode (Concept §5): static output with an index.html fallback that
      // client-side-routes every path. No SSR, no service-worker machinery.
      adapter: adapter({
        pages: 'build',
        assets: 'build',
        fallback: 'index.html',
        precompress: false,
        strict: false
      })
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.BLEAK_NODE_URL || 'http://localhost:8080',
        changeOrigin: true
      },
      '/h': {
        target: process.env.HELPER_DEV_URL || 'http://localhost:8787',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/h/, '')
      }
    }
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts']
  }
});
