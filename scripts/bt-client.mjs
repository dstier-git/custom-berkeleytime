/**
 * Minimal client for the Berkeleytime GraphQL API.
 *
 * Endpoint is POST-only: Apollo's CSRF prevention rejects GET, and rejects any
 * request without an explicit JSON content-type. There is no auth and no
 * published rate-limit policy, so every call goes through `gql()` which
 * throttles and retries rather than hammering a student-run service.
 */

export const ENDPOINT = 'https://berkeleytime.com/api/graphql'

const MIN_INTERVAL_MS = 120
let lastCallAt = 0

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function gql(query, variables = {}, { retries = 4 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const wait = lastCallAt + MIN_INTERVAL_MS - Date.now()
    if (wait > 0) await sleep(wait)
    lastCallAt = Date.now()

    let res
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'berkeleycourseai/1.0 (personal course planning)',
        },
        body: JSON.stringify({ query, variables }),
      })
    } catch (err) {
      if (attempt >= retries) throw err
      await sleep(500 * 2 ** attempt)
      continue
    }

    if (!res.ok) {
      if (attempt >= retries || (res.status < 500 && res.status !== 429)) {
        throw new Error(`Berkeleytime HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
      }
      await sleep(500 * 2 ** attempt)
      continue
    }

    const body = await res.json()
    if (body.errors?.length) {
      // GraphQL-level errors are deterministic — retrying will not help, and
      // silently returning partial data would poison every downstream verdict.
      throw new Error(`Berkeleytime GraphQL error: ${body.errors.map((e) => e.message).join(' | ')}`)
    }
    return body.data
  }
}

/** Stable identity for a class section within a term. */
export const classKey = (c) => `${c.sessionId}|${c.subject}|${c.courseNumber}|${c.number}`

/** Stable identity for a course, independent of section. */
export const courseKey = (subject, number) => `${subject}|${number}`
