import { defineConfig, type Plugin } from 'vite'

const CSP = "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'"

/**
 * GitHub Pages cannot set headers, so the policy has to travel in the
 * document. It ships in the built document only: the dev server injects every
 * stylesheet as an inline <style> element, which this policy correctly
 * refuses, and serving it in development would mean weakening style-src to
 * 'unsafe-inline' for the deployed site too. The build emits an external
 * module script and an external stylesheet, so no nonce is needed.
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'cooking-battle:csp-meta',
    apply: 'build',
    transformIndexHtml() {
      return [{
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
        injectTo: 'head-prepend',
      }]
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [contentSecurityPolicy()],
})
