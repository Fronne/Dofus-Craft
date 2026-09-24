import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// specs/014-admin-counters: the administration page is a second entry point, built separately into
// dist-admin/ and served by the dofus-craft-admin Worker (protected by Cloudflare Access). It reuses
// the site's styles, components and public/ assets (class portraits).
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig({
  root: fileURLToPath(new URL('./admin', import.meta.url)),
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    outDir: fileURLToPath(new URL('./dist-admin', import.meta.url)),
    emptyOutDir: true,
  },
  server: { port: 5175, strictPort: true },
});
