import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    server: {
      port: 3001,
      host: '0.0.0.0',
      proxy: {
        '/api': 'http://localhost:3002',
        '/generated_scripts': 'http://localhost:3002',
      },
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY || ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'process.env.GEMINI_API_KEYS': JSON.stringify(env.GEMINI_API_KEYS || ''),
      'process.env.GEMINI_IMAGE_MODELS': JSON.stringify(env.GEMINI_IMAGE_MODELS || ''),
      'process.env.GEMINI_IMAGEN_MODELS': JSON.stringify(env.GEMINI_IMAGEN_MODELS || ''),
    },
    build: {
      outDir: 'dist',
    },
  };
});
