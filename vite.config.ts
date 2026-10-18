import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 相対パスで出力し、GitHub Pages などのサブパスでも動くようにする
// `vite build --mode inline` のときは絵もJSに埋め込む（1枚のHTMLにまとめて配るとき用）
// `--mode inline-art` は絵だけ埋め込み、音は別のファイルにする（ページの大きさを抑えて公開するとき用）
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react()],
  build: { assetsInlineLimit: mode === 'inline' ? 100_000_000 : mode === 'inline-art' ? (file: string) => !file.endsWith('.mp3') : 4096 },
}))
