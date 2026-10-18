import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages (https://<user>.github.io/shiba-run/) でも動くよう相対パスで出力する
  base: './',
  // 同じWi-Fiのスマホから http://<PCのIP>:5173 でアクセスできるようにする
  server: { host: true },
  preview: { host: true },
  // three.js を含むため 500KB の警告ラインを少し上げる
  build: { chunkSizeWarningLimit: 800 },
});
