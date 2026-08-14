/**
 * Browser-side CalCentral Academic Summary parser.
 *
 * pdf.js extracts link annotations (the class URIs) and visible text. The
 * same regex the Node CLI uses then pulls course codes out of that haystack.
 * Nothing leaves the machine — no API route, no CDN worker.
 */

import {
  DEFAULT_TARGET,
  decodeLatin1,
  extractCoursesFromText,
  guessMetadata,
  haystackFromPdfParts,
  parseProfileJson,
  profileFromTranscript,
  transcriptFromSemesters,
  type ParsedTranscript,
  type ProfileMeta,
} from './parse-calcentral-core.mjs'

export {
  parseProfileJson,
  profileFromTranscript,
  type ParsedTranscript,
  type ProfileMeta,
}

let workerReady = false

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist')
  if (!workerReady && typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
    workerReady = true
  }
  return pdfjs
}

export async function parseCalCentralPdf(
  data: ArrayBuffer,
  targetKey: string = DEFAULT_TARGET,
): Promise<ParsedTranscript> {
  const pdfjs = await loadPdfjs()
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  // getDocument may transfer the buffer; keep a copy for the latin-1 scan.
  const forPdf = bytes.slice()

  const pdf = await pdfjs.getDocument({ data: forPdf }).promise
  const urls: string[] = []
  const textParts: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const [annotations, textContent] = await Promise.all([
      page.getAnnotations(),
      page.getTextContent(),
    ])
    for (const a of annotations as { url?: string; unsafeUrl?: string }[]) {
      const url = a.url || a.unsafeUrl
      if (url) urls.push(url)
    }
    textParts.push(
      textContent.items
        .map((it) => ('str' in it ? it.str : ''))
        .join(' '),
    )
  }

  const text = textParts.join('\n')
  const haystack = haystackFromPdfParts({
    urls,
    text,
    rawLatin1: decodeLatin1(bytes),
  })

  const semesters = extractCoursesFromText(haystack)
  if (!semesters.size) {
    throw new Error('No courses found in this PDF. Is this a CalCentral Academic Summary?')
  }

  return {
    ...transcriptFromSemesters(semesters, targetKey),
    suggested: guessMetadata(text),
  }
}
