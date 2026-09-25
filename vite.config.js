import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Vite Configuration for Smart Food Waste Tracker
 * Configures React plugin, relative asset resolution, and development server options.
 * 
 * @see https://vite.dev/config/
 */
export default defineConfig({
  plugins: [react()],
  // Relative base path ensures smooth hosting compatibility across Vercel and GitHub Pages
  base: './',
  server: {
    port: 5173,
    open: false
  }
})

