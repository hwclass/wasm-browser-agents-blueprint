import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: './demos',
  publicDir: '../public',
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
    outDir: '../dist',
    emptyOutDir: true,
    target: 'esnext',
    rollupOptions: {
      input: {
        'hello-agent': path.resolve(__dirname, 'demos/hello-agent/index.html'),
        'handoff': path.resolve(__dirname, 'demos/handoff/index.html'),
        'tool-calling': path.resolve(__dirname, 'demos/tool-calling/index.html'),
      },
      output: {
        // Optimize chunk size for different types of content
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // Separate chunks for different components
        manualChunks: {
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
