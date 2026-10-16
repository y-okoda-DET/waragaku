import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 相対パスで出力し、GitHub Pages などのサブパスでも動くようにする
export default defineConfig({
  base: './',
  plugins: [react()],
})
