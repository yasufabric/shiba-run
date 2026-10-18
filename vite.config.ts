import { defineConfig } from 'vite';

export default defineConfig({
  // 同じWi-Fiのスマホから http://<PCのIP>:5173 でアクセスできるようにする
  server: { host: true },
  preview: { host: true },
});
