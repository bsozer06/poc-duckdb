import { defineConfig } from 'vite';

export default defineConfig({
  // DuckDB-WASM'ın kendi WASM/worker dosyalarını Vite optimize etmemesi için exclude
  optimizeDeps: {
    exclude: ['@duckdb/duckdb-wasm'],
  },
  server: {
    port: 3333,
    // SharedArrayBuffer için gerekli güvenlik başlıkları
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    port: 3333,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
