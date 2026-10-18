// 公開用のビルド：絵はHTMLに埋め込み、音は同じ階層の別ファイルにする（ページを16MB未満に抑えるため）
// 使い方：npx vite build --mode inline-art && node scripts/publish_build.mjs <inline.mjs> <出力先フォルダ>
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
const [inline, out] = process.argv.slice(2)
fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(out, { recursive: true })
for (const f of fs.readdirSync('dist/assets')) if (f.endsWith('.map')) fs.rmSync(path.join('dist/assets', f))
execFileSync('node', [inline, 'dist', path.join(out, 'waragaku.html')], { stdio: 'inherit' })
const html = path.join(out, 'waragaku.html')
// import.meta.url を使わず、ページからの相対パスで読む（公開ページでは import.meta.url が当てにならないため）
const s = fs.readFileSync(html, 'utf8').replace(/""\+new URL\("([\w-]+\.mp3)",import\.meta\.url\)\.href/g, '"$1"')
fs.writeFileSync(html, s)
for (const f of fs.readdirSync('dist/assets')) if (f.endsWith('.mp3')) fs.copyFileSync(path.join('dist/assets', f), path.join(out, f))
console.log(fs.readdirSync(out).join('\n'))
