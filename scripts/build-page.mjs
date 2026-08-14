/**
 * Step 5 — inline the dataset into the interface template.
 *
 * The Artifact CSP blocks every external request, so the data has to travel
 * inside the HTML rather than being fetched at runtime.
 *
 * Output: web/fall2026-triage.html
 */

import { readFile, writeFile } from 'node:fs/promises'

const url = (p) => new URL(p, import.meta.url)

const template = await readFile(url('../web/triage.template.html'), 'utf8')
const data = await readFile(url('../data/fall2026-triage.json'), 'utf8')

if (!template.includes('__DATA__')) throw new Error('template is missing the __DATA__ placeholder')

// `</script>` inside the JSON would close the host script tag early; U+2028
// and U+2029 are valid in JSON but illegal raw inside a JS string literal.
const safe = data
  .replace(/<\//g, '<\\/')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029')

const html = template.replace('__DATA__', safe)
await writeFile(url('../web/fall2026-triage.html'), html)

console.log(`wrote web/fall2026-triage.html — ${(html.length / 1048576).toFixed(2)} MB`)
