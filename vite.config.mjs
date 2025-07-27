import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: './demos/hello-agent',
  server: {
    headers: {
      // Add WASM MIME type and CORS headers
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    middlewares: [
      // Custom middleware to set WASM MIME type
      (req, res, next) => {
        if (req.url.endsWith('.wasm')) {
          res.setHeader('Content-Type', 'application/wasm');
        }
        next();
      }
    ],
    hmr: true,
    watch: {
      usePolling: false
    }
  },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    target: 'esnext',
    lib: {
      entry: path.resolve(__dirname, 'src/main.js'),
      name: 'browser-agents-blueprint',
      formats: ['es'],
      fileName: (format) => `browser-agents-blueprint.${format}.js`,
    },
    rollupOptions: {
      input: path.resolve(__dirname, 'demos/hello-agent/index.html'),
      output: {
        // Optimize chunk size for different types of content
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // Separate chunks for different agents
        manualChunks: {
          'rust-agent': ['./demos/hello-agent/worker-rust.js'],
          'go-agent': ['./demos/hello-agent/worker-go.js'],
          'python-agent': ['./demos/hello-agent/worker-py.js'],
          'js-agent': ['./demos/hello-agent/worker-js.js'],
          'webllm': ['@mlc-ai/web-llm'],
          'comlink': ['comlink']
        }
      }
    },
    // Enable minification with esbuild
    minify: 'esbuild',
    // Preserve WASM modules
    assetsInlineLimit: 0
  },
  optimizeDeps: {
    exclude: ['@mlc-ai/web-llm'],
    include: ['comlink']
  },
  // Enable source maps for debugging
  sourcemap: true
});
