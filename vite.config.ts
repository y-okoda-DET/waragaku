import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 相対パスで出力し、GitHub Pages などのサブパスでも動くようにする
// `vite build --mode inline` のときは絵もJSに埋め込む（1枚のHTMLにまとめて配るとき用）
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react()],
  build: { assetsInlineLimit: mode === 'inline' ? 100_000_000 : 4096 },
}))
