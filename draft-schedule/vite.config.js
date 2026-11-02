import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import outlookDevPlugin from './scripts/outlook-dev-plugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), outlookDevPlugin()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
