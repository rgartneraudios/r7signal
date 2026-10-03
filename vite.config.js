import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { isHmrProtected } from './plugins/hmrProtect.js'

function cochiHmrGuard() {
  let turnActive = false
  const deferred = new Set()
  return {
    name: 'cochi-hmr-guard',
    apply: 'serve',
    configureServer(server) {
      server.ws.on('cochi:turn', ({ active } = {}) => {
        turnActive = !!active
        if (!turnActive && deferred.size) {
          const count = deferred.size
          deferred.clear()
          server.ws.send({ type: 'custom', event: 'cochi:hmr-pending', data: { count } })
        }
      })
    },
    hotUpdate: {
      order: 'post',
      handler(options) {
        if (!turnActive) return
        if (!isHmrProtected(options.file, options.server?.config?.root)) return
        deferred.add(options.file)
        return []
      },
    },
  }
}

// Bloque V (performance): partimos el bundle monolítico (~1.3 MB) en chunks
// separados por librería, para que el arranque cargue/compile por capas y el
// navegador pueda cachear cada grupo por separado. No cambia la lógica; sólo
// cómo se empaqueta.
const MARKDOWN = /[\\/]node_modules[\\/](react-markdown|react-syntax-highlighter|refractor|prismjs|highlight\.js|highlightjs-vue|lowlight|hastscript|parse-entities|style-to-js|style-to-object|estree-util-is-identifier-name|hast-util-|mdast-util-|micromark|remark-|rehype-|unified|unist-util-|vfile|devlop|property-information|space-separated-tokens|comma-separated-tokens|trim-lines|html-url-attributes|character-entities|decode-named-character-reference|stringify-entities|character-reference-invalid|hast-util-to-jsx-runtime)/

const chunkFor = (id) => {
  if (!id.includes('node_modules')) {
    // Helper virtual de Vite para import() dinámico: si Rollup lo mete en el
    // chunk de markdown, el entry lo importa estáticamente y arruina el
    // lazy-load. Forzarlo a `vendor` (ya estático y chico) evita eso.
    if (id.includes('vite/preload-helper')) return 'vendor'
    return
  }
  if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor'
  if (MARKDOWN.test(id)) return 'markdown'
  if (id.includes('@supabase')) return 'supabase'
  if (id.includes('@tauri-apps')) return 'tauri'
  return 'vendor'
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cochiHmrGuard()],
  build: {
    chunkSizeWarningLimit: 800,
    // En Tauri los assets son locales (sin waterfall de red), así que el
    // modulePrefetch de Vite no aporta; y su helper terminaba haciendo que el
    // chunk de markdown se importara estáticamente, arruinando el lazy-load.
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks: chunkFor,
      },
    },
  },
})