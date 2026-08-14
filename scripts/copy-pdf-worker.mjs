/**
 * Copy pdf.js's worker into public/ so the browser loads it from this origin,
 * not a CDN. Run before next dev / next build.
 */
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const src = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs')
const dest = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'pdf.worker.min.mjs')

mkdirSync(dirname(dest), { recursive: true })
copyFileSync(src, dest)
console.log(`copied pdf.worker.min.mjs → public/`)
