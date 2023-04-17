import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'serve') {
    return {
      plugins: [svelte()]
    };
  } else if (command === 'build') {
    switch (mode) {
      case 'github': {
        return {
          build: {
            base: '',
            outDir: 'dist'
          },
          plugins: [svelte()]
        };
      }

      case 'preview': {
        return {
          build: {
            outDir: 'dist'
          },
          plugins: [svelte()]
        };
      }

      default: {
        console.error('Unknown build mode!');
        return null;
      }
    }
  }
});
