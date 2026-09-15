// Portal "My site" helpers (NIP-5A, plan §6/D8).
//
// The native API keeps all manifest/digest logic server-side (publish.plan
// returns the unsigned event + plan_sha256), so this client only hashes the
// selected files for the inventory and uploads blob bytes to the user's
// Blossom servers (BUD-01, `Access-Control-Allow-Origin: *`). Everything
// mirrors the admin console's `lib/nsite` (Phase 3a) so the two surfaces
// behave identically.

export type InventoryItem = { path: string; sha256: string; size: number }
export type ManifestItem = { path: string; sha256: string }

export const DEFAULT_MAX_BLOB_BYTES = 32 * 1024 * 1024 // 32 MiB

export class NsiteError extends Error {}

function badPath(path: string): boolean {
  // Mirrors the fork's `_path_is_bad`: reject control chars (\p{Cc}), a
  // backslash, and any `..` substring (which would let an upload escape its
  // site dir).
  if (/\p{Cc}/u.test(path)) return true
  if (path.includes('\\')) return true
  for (const segment of path.split('/')) {
    if (segment.includes('..')) return true
  }
  return false
}

function normalizePath(relative: string): string {
  const parts = relative.split('/').filter(Boolean)
  // `webkitdirectory` selections share the selected folder as their first
  // segment; that folder is the site root, so NIP-5A paths are relative to it.
  const rooted = parts.length > 1 ? parts.slice(1) : parts
  return '/' + rooted.join('/')
}

export async function sha256Hex(
  bytes: ArrayBuffer | Uint8Array,
): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

export async function inventoryFromFiles(
  files: File[],
  options: { maxBlobBytes?: number } = {},
): Promise<InventoryItem[]> {
  const maxBlobBytes = options.maxBlobBytes ?? DEFAULT_MAX_BLOB_BYTES
  const items: InventoryItem[] = []
  for (const file of files) {
    const relative = file.webkitRelativePath || file.name
    if (!relative) continue
    if (badPath(relative)) {
      throw new NsiteError(`rejected unsafe path: ${relative}`)
    }
    if (file.size > maxBlobBytes) {
      throw new NsiteError(
        `file exceeds the ${maxBlobBytes} byte limit: ${relative}`,
      )
    }
    const path = normalizePath(relative)
    if (file.size === 0) continue // NIP-5A has no empty-blob concept; skip
    const sha256 = await sha256Hex(await file.arrayBuffer())
    items.push({ path, sha256, size: file.size })
  }
  if (!items.length) {
    throw new NsiteError('no files selected')
  }
  items.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  return items
}

export function aggregateSize(items: InventoryItem[]): number {
  return items.reduce((sum, item) => sum + item.size, 0)
}

// -- Blossom upload (NIP-96 / BUD-01..03) ----------------------------------- //

export const BUD_AUTH_KIND = 24242
export const BATCH_SIZE = 20
export const SKIP_HEAD_TIMEOUT_MS = 8000
export const PUT_TIMEOUT_MS = 120_000

export type BlossomResult = {
  server: string
  ok: boolean
  uploaded: string[]
  skipped: string[]
  failed: string[]
  errors: Record<string, string>
}

export function encodeAuthHeader(event: object): string {
  const bytes = new TextEncoder().encode(JSON.stringify(event))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function withTimeout(ms: number, signal?: AbortSignal): AbortController {
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  const timer = setTimeout(() => controller.abort(), ms)
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', onAbort)
  }
  controller.signal.addEventListener('abort', () => clearTimeout(timer), {
    once: true,
  })
  return controller
}

async function headPresent(
  server: string,
  hash: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const controller = withTimeout(SKIP_HEAD_TIMEOUT_MS, signal)
  try {
    const response = await fetch(`${server}/${hash}`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    })
    return response.ok
  } catch {
    return false
  } finally {
    controller.abort()
  }
}

async function putBlob(
  server: string,
  hash: string,
  bytes: Uint8Array,
  authEvent: object,
  signal?: AbortSignal,
): Promise<void> {
  const controller = withTimeout(PUT_TIMEOUT_MS, signal)
  try {
    const response = await fetch(`${server}/upload?sha256=${hash}`, {
      method: 'PUT',
      headers: {
        Authorization: `Nostr ${encodeAuthHeader(authEvent)}`,
        'Content-Type': 'application/octet-stream',
      },
      body: bytes,
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')) || response.status
      throw new NsiteError(`PUT /upload failed (${detail})`)
    }
  } finally {
    controller.abort()
  }
}

export async function uploadToBlossom(
  server: string,
  items: ManifestItem[],
  blobBytes: (path: string) => Promise<Uint8Array | null>,
  options: {
    pubkey: string
    signEvent: (event: {
      pubkey: string
      created_at: number
      kind: number
      tags: string[][]
      content: string
    }) => Promise<{ id: string; sig: string }>
    onProgress?: (uploaded: number, total: number, path: string) => void
    signal?: AbortSignal
  },
): Promise<BlossomResult> {
  const serverBase = server.replace(/\/+$/, '')
  const result: BlossomResult = {
    server,
    ok: true,
    uploaded: [],
    skipped: [],
    failed: [],
    errors: {},
  }

  const toUpload = new Map<string, ManifestItem>()
  for (const item of items) {
    if (await headPresent(serverBase, item.sha256, options.signal)) {
      result.skipped.push(item.sha256)
      continue
    }
    toUpload.set(item.sha256, item)
  }

  const hashes = [...toUpload.keys()]
  for (let start = 0; start < hashes.length; start += BATCH_SIZE) {
    const batch = hashes.slice(start, start + BATCH_SIZE)
    if (options.signal?.aborted) break
    const authEvent = await options.signEvent({
      pubkey: options.pubkey,
      created_at: Math.floor(Date.now() / 1000),
      kind: BUD_AUTH_KIND,
      tags: batch.map((hash) => ['x', hash]),
      content: '',
    })
    for (const hash of batch) {
      if (options.signal?.aborted) break
      const item = toUpload.get(hash)!
      const bytes = await blobBytes(item.path)
      if (!bytes) {
        result.failed.push(hash)
        result.errors[hash] = 'cannot read local file'
        continue
      }
      let ok = false
      for (let attempt = 0; attempt < 2 && !ok; attempt++) {
        try {
          await putBlob(serverBase, hash, bytes, authEvent, options.signal)
          ok = true
        } catch (cause) {
          result.errors[hash] =
            cause instanceof Error ? cause.message : String(cause)
        }
      }
      if (ok) {
        result.uploaded.push(hash)
        options.onProgress?.(result.uploaded.length, hashes.length, item.path)
      } else {
        result.failed.push(hash)
      }
    }
  }

  if (result.failed.length) {
    result.ok = false
  } else if (!hashes.length) {
    // Nothing needed uploading on this server; still report success.
    result.ok = true
  }
  return result
}

export async function blobBytesOfFile(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer())
}
