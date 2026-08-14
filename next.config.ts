import type { NextConfig } from 'next'
import { copyFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

// Serve pdf.js's worker from /pdf.worker.min.mjs (this origin, not a CDN).
try {
  const require = createRequire(import.meta.url)
  const src = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs')
  const dest = join(process.cwd(), 'public', 'pdf.worker.min.mjs')
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(src, dest)
} catch {
  // pdfjs-dist not installed yet
}

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.alias.canvas = false
    return config
  },
}

export default nextConfig
