import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: '/cars-game/',
  plugins: [vue()],
  server: {
    port: 8080,
  },
})
