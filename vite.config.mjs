import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: './demos/hello-agent',
  build: {
    outDir: './dist',
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, 'src/main.js'),
      name: 'browser-agents-blueprint',
      formats: ['es', 'umd'],
      fileName: (format) => `browser-agents-blueprint.${format}.js`,
    },
    rollupOptions: {
      input: path.resolve(__dirname, 'demos/hello-agent/index.html'),
      output: {
        // Optimize chunk size
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Enable minification with esbuild (included with Vite)
    minify: 'esbuild'
  },
  resolve: {
    alias: {
      // No more LangChain aliases needed
    }
  },
  optimizeDeps: {
    include: [
      '@mlc-ai/web-llm',
      'comlink'
    ]
  },
  // Enable source maps for debugging
  sourcemap: true,
  // Optimize dev server
  server: {
    hmr: true,
    watch: {
      usePolling: false
    }
  }
});
