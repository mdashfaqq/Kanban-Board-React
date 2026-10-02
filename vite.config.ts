import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Render runs `vite preview`; allow its public hostname.
  preview: {
    allowedHosts: ['.onrender.com'],
  },
})
