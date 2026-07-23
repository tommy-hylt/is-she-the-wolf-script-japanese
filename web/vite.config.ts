import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  // The site may be mounted below an arbitrary reverse-proxy subdirectory.
  base: './',
  plugins: [react()],
});
