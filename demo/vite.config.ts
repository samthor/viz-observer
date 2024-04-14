import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'esnext',
    modulePreload: {
      polyfill: false,
    },
  },
});
