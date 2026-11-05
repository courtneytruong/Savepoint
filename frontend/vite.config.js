import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // The browser only talks to this dev server, which passes these requests
      // to the API, so the API doesn't need CORS rules. 127.0.0.1 avoids the
      // delay of trying IPv6 first, because the API only listens on IPv4.
      '/health': 'http://127.0.0.1:8080',
    },
  },
})
