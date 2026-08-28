import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages 仓库名子路径部署：https://violette-112.github.io/wuliyao/
  base: process.env.VITE_BASE || '/wuliyao/',
  plugins: [react()],
  server: {
    port: 5182,
    open: true
  }
})
