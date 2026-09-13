import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    host: '0.0.0.0',
    allowedHosts:['https://finance-frontend-50cw.onrender.com'],
  //server: {
  //  proxy: {
   //   '/api': 'http://localhost:4000',
   // },
 // },
  },
})
