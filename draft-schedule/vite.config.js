import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import packageJson from './package.json'

// https://vite.dev/config/
export default defineConfig({
  cacheDir: 'artifacts/vite-dev-cache',
  plugins: [react(), tailwindcss()],
  // Forecast is lazy-loaded; prepare its animation modules before navigation.
  optimizeDeps: {
    noDiscovery: true,
    include: [
      ...Object.keys(packageJson.dependencies).filter(name => name !== 'firebase'),
      'react-dom/client', 'motion/react', 'firebase/app', 'firebase/auth', 'firebase/database',
    ],
  },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
