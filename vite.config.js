import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
  plugins: [react()],
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