import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

function copyStaticPwaAssets() {
  const rootDir = import.meta.dirname;
  const distDir = path.resolve(rootDir, 'dist');
  const filesToCopy = [
    'hiragana_strokes.json',
    'manifest.json',
    'sw.js',
    'icon-192.png',
    'icon-512.png',
    'apple-touch-icon.png',
  ];
  const dirsToCopy = ['hiragana', 'audio'];

  return {
    name: 'copy-static-pwa-assets',
    closeBundle() {
      if (!fs.existsSync(distDir)) return;
      for (const file of filesToCopy) {
        const src = path.resolve(rootDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, path.resolve(distDir, file));
        }
      }
      for (const dir of dirsToCopy) {
        const srcDir = path.resolve(rootDir, dir);
        if (fs.existsSync(srcDir)) {
          fs.cpSync(srcDir, path.resolve(distDir, dir), {recursive: true});
        }
      }
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), copyStaticPwaAssets()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
    },
  };
});
