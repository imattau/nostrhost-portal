import DOMPurify from 'dompurify'

// Central HTML sanitizer for every `v-html` sink. Content that reaches the
// portal as HTML — app descriptions (authored by app packagers, i.e.
// untrusted third parties), admin intro text, custom SVG logos — is rendered
// only after DOMPurify has stripped active content (scripts, event handlers,
// javascript:/data: URLs, <foreignObject> etc.). This closes the stored-XSS
// path where a malicious app description executes on the portal origin, which
// also stores user Nostr keys.
//
// DOMPurify is configured allowlist-only (default) and runs in the browser.
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return ''
  return DOMPurify.sanitize(dirty, {
    // Keep the tags the portal's own styles expect (links, emphasis,
    // headings, lists, blockquotes, images/video) while forbidding active
    // content by default.
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'svg', 'math'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'style'],
  })
}