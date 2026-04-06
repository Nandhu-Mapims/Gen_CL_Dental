/**
 * Build an absolute URL for stored upload paths such as `/uploads/session-signatures/...`.
 * Static files are mounted at `/uploads` on the API server, not under `/api`.
 *
 * - Optional `VITE_UPLOADS_BASE_URL` (no trailing slash) overrides the host/base.
 * - If `VITE_API_URL` is an absolute http(s) URL, use its origin only so paths like
 *   `/api` or `/api/v1` do not leak into the uploads URL.
 * - Otherwise use the current page origin (Vite dev proxy for `/uploads`, or same-origin prod).
 */
export function resolveUploadUrl(storedPath) {
  if (!storedPath || typeof storedPath !== 'string') return ''
  const trimmed = storedPath.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  const p = trimmed.startsWith('/') ? trimmed : `/${trimmed}`

  const uploadsBase =
    typeof import.meta !== 'undefined' ? import.meta.env?.VITE_UPLOADS_BASE_URL : undefined
  if (uploadsBase && typeof uploadsBase === 'string') {
    const base = uploadsBase.trim().replace(/\/$/, '')
    if (base) return `${base}${p}`
  }

  const apiBase = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_URL : undefined
  if (apiBase && typeof apiBase === 'string') {
    const s = apiBase.trim()
    if (s.startsWith('http://') || s.startsWith('https://')) {
      try {
        return `${new URL(s).origin}${p}`
      } catch {
        /* ignore invalid URL */
      }
    }
  }

  if (typeof window !== 'undefined') return `${window.location.origin}${p}`
  return p
}
