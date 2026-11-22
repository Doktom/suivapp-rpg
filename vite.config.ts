import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/suivapp-rpg/',
  plugins: [react(), tailwindcss()],
  // The browser checks in e2e/ are run by Playwright (npm run e2e), not by Vitest.
  test: { exclude: ['e2e/**', 'node_modules/**', 'dist/**'] },
})
