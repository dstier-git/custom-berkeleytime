/**
 * Does pdf.js + the shared regex extract the same courses as `strings` + the
 * original parse-calcentral.mjs regex?
 *
 * Usage:
 *   node scripts/verify-pdf-parse.mjs
 *   node scripts/verify-pdf-parse.mjs "Academic Summary _ CalCentral.pdf"
 */
import { execSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import {
  DEFAULT_TARGET,
  decodeLatin1,
  extractCoursesFromText,
  haystackFromPdfParts,
  transcriptFromSemesters,
} from '../lib/parse-calcentral-core.mjs'

GlobalWorkerOptions.workerSrc = pathToFileURL(
  new URL('../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).pathname,
).href

function listFromMap(semesters) {
  return [...semesters.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, courses]) => `${k}: ${courses.join(', ')}`)
}

async function extractWithPdfjs(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const pdf = await getDocument({ data: bytes.slice(), disableWorker: true }).promise
  const urls = []
  const textParts = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const [annotations, textContent] = await Promise.all([
      page.getAnnotations(),
      page.getTextContent(),
    ])
    for (const a of annotations) {
      const url = a.url || a.unsafeUrl
      if (url) urls.push(url)
    }
    textParts.push(textContent.items.map((it) => it.str || '').join(' '))
  }
  const haystack = haystackFromPdfParts({
    urls,
    text: textParts.join('\n'),
    rawLatin1: decodeLatin1(bytes),
  })
  return extractCoursesFromText(haystack)
}

async function main() {
  const pdfPath = process.argv[2] ?? 'Academic Summary _ CalCentral.pdf'
  const data = new Uint8Array(await readFile(pdfPath))
  const viaStrings = extractCoursesFromText(execSync(`strings "${pdfPath}"`, {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  }))
  const viaPdfjs = await extractWithPdfjs(data)

  const a = listFromMap(viaStrings)
  const b = listFromMap(viaPdfjs)
  const same = a.join('\n') === b.join('\n')

  const parsed = transcriptFromSemesters(viaPdfjs, DEFAULT_TARGET)
  console.log('strings:')
  console.log(a.map((l) => `  ${l}`).join('\n'))
  console.log('pdfjs:')
  console.log(b.map((l) => `  ${l}`).join('\n'))
  console.log(`\ncompleted: ${parsed.completed.length} across ${parsed.termsCompleted} terms (target ${parsed.targetKey})`)
  console.log(same ? 'OK — pdf.js matches strings' : 'MISMATCH — pdf.js and strings disagree')
  if (!same) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
