import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const originalName = assetInfo.name || 'asset';
          const lastDot = originalName.lastIndexOf('.');
          const name = (lastDot > 0 ? originalName.substring(0, lastDot) : originalName)
            .replace(/[\s()]+/g, '_')
            .toLowerCase();
          const ext = lastDot > 0 ? originalName.substring(lastDot) : '';
          return `assets/${name}-[hash]${ext}`;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  }
})
